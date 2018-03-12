const {promisify} = require('util');
const test = require('ava');
const request = require('supertest');
const {range} = require('pythonic');
const {bootstrapKoaApp} = require('./src/util');

const agendaAppUrl = 'http://localhost:4041';
const testAppUrl = 'http://localhost:4042';
const {app: testApp, router: testAppRouter} = bootstrapKoaApp();
const getTestAppUrl = path => path ? `${testAppUrl}${path}` : testAppUrl;

const agendaAppRequest = request(agendaAppUrl);

const bootstrapApp = async () => {
  const {app, jobsReady} = require('./src');
  await promisify(app.listen).bind(app)(4041)
    .then(() => console.log('agenda-rest app running'));

  await promisify(testApp.listen).bind(testApp)(4042)
    .then(() => console.log('test app running'));
  await jobsReady;
};

test.before(() => bootstrapApp());

test.serial('POST /api/job fails without content', async t => {
  const res = await agendaAppRequest
    .post('/api/job')
    .send();

  t.is(res.status, 400);
});

test.serial('POST /api/job succeeds when a job is specified', async t => {
  const res = await agendaAppRequest
    .post('/api/job')
    .send({name: 'foo', url: getTestAppUrl('/fooWrong')});

  t.is(res.status, 200);
});

test.serial('PUT /api/job fails when the job does not exists', async t => {
  const res = await agendaAppRequest
    .put('/api/job/fooWrong')
    .send({url: getTestAppUrl('/foo')});

  t.is(res.status, 400);
});

test.serial('PUT /api/job succeeds when the job exists', async t => {
  const res = await agendaAppRequest
    .put('/api/job/foo')
    .send({url: getTestAppUrl('/foo')});

  t.is(res.status, 200);
});

const testAppCalled = async (defineEndpoint, thisManyTimes = 1) => {
  const calls = range(thisManyTimes).map(() => new Promise(resolve => defineEndpoint(resolve)));
  return Promise.all(calls);
};

const defineEndpointFoo = done => testAppRouter.post('/foo', async (ctx, next) => {
  console.log('foo invoked!');
  ctx.body = 'foo success';
  ctx.status = 200;
  done();
  await next();
});
/* TODO
const defineEndpointFooParam = done => testAppRouter.post('/foo/:fooParam', async (ctx, next) => {
  console.log('foo with params invoked!');
  console.log(ctx.params);
  console.log(ctx.request.body);
  ctx.body = 'foo with params success';
  ctx.status = 200;
  done();
  await next();
});

const defineEndpointFooCallback = done => testAppRouter.post('/foo/cb', async (ctx, next) => {
  console.log('foo callback invoked!');
  ctx.body = 'foo callback success';
  ctx.status = 200;
  done();
  await next();
});
*/

test.serial('POST /api/job/now with existing foo definition invokes the foo endpoint', async t => {
  const fooInvoked = testAppCalled(defineEndpointFoo);
  const res = await agendaAppRequest
    .post('/api/job/now')
    .send({name: 'foo'});

  t.is(res.text, 'job scheduled for now');

  return fooInvoked;
});

test.serial('POST /api/job/every with existing foo definition invokes the foo endpoint', async t => {
  const fooInvoked = testAppCalled(defineEndpointFoo, 3);
  const res = await agendaAppRequest
    .post('/api/job/every')
    .send({name: 'foo', interval: '10 miliseconds'});

  t.is(res.text, 'job scheduled for repetition');

  return fooInvoked;
});

test.serial('DELETE /api/job succeeds when a job is defined', async t => {
  const res = await agendaAppRequest
    .delete('/api/job/foo');

  t.is(res.status, 200);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = path.resolve(process.cwd());

test('Scheduling UI & Case Creation Integration Tests', async (t) => {
  await t.test('1. HTML Markup Structure in dashboard.html', () => {
    const htmlPath = path.join(rootDir, 'public', 'dashboard.html');
    const html = fs.readFileSync(htmlPath, 'utf8');

    assert.ok(html.includes('id="scheduleDeliveryGroup"'), 'scheduleDeliveryGroup container must exist');
    assert.ok(html.includes('id="btnDeliveryNow"'), 'btnDeliveryNow toggle button must exist');
    assert.ok(html.includes('id="btnDeliverySchedule"'), 'btnDeliverySchedule toggle button must exist');
    assert.ok(html.includes('id="scheduleOptionsContainer"'), 'scheduleOptionsContainer must exist and be hidden by default');
    assert.ok(html.includes('id="scheduleDatetime"'), 'scheduleDatetime input (datetime-local) must exist');
    assert.ok(html.includes('id="scheduleRecurrence"'), 'scheduleRecurrence select dropdown must exist');
    assert.ok(html.includes('value="one_off"'), 'one_off recurrence option must exist');
    assert.ok(html.includes('value="daily"'), 'daily recurrence option must exist');
    assert.ok(html.includes('value="weekly"'), 'weekly recurrence option must exist');
    assert.ok(html.includes('value="monthly"'), 'monthly recurrence option must exist');
  });

  await t.test('2. CSS Styling Rules in dashboard.css', () => {
    const cssPath = path.join(rootDir, 'public', 'css', 'dashboard.css');
    const css = fs.readFileSync(cssPath, 'utf8');

    assert.ok(css.includes('.delivery-toggle-container'), '.delivery-toggle-container rule must exist');
    assert.ok(css.includes('.delivery-toggle-btn'), '.delivery-toggle-btn rule must exist');
    assert.ok(css.includes('.delivery-toggle-btn.active'), '.delivery-toggle-btn.active rule must exist');
  });

  await t.test('3. JavaScript Wizard State Machine & Scheduling Helpers in app.js', () => {
    const jsPath = path.join(rootDir, 'public', 'js', 'app.js');
    const js = fs.readFileSync(jsPath, 'utf8');

    assert.ok(js.includes('schedule: null'), 'wizardState must include schedule property');
    assert.ok(js.includes('function setDeliveryTiming'), 'setDeliveryTiming function must exist');
    assert.ok(js.includes('function getSchedulePayloadFromInputs'), 'getSchedulePayloadFromInputs helper must exist');
    assert.ok(js.includes('btnDeliveryNow'), 'btnDeliveryNow event listener must exist');
    assert.ok(js.includes('btnDeliverySchedule'), 'btnDeliverySchedule event listener must exist');
    assert.ok(js.includes('scheduled: "Scheduled"'), 'formatWhatsAppDeliveryStatus must map scheduled');
    assert.ok(js.includes('unknown: "Unknown"'), 'formatWhatsAppDeliveryStatus must map unknown');
    assert.ok(js.includes("st === 'scheduled'"), 'getWhatsAppDeliveryBadgeHtml must handle scheduled status');
    assert.ok(js.includes("st === 'unknown'"), 'getWhatsAppDeliveryBadgeHtml must handle unknown status');
  });

  await t.test('4. Backend Case Scheduling Handler Support in src/api/cases.js', () => {
    const apiPath = path.join(rootDir, 'src', 'api', 'cases.js');
    const api = fs.readFileSync(apiPath, 'utf8');

    assert.ok(api.includes('body.schedule && body.schedule.scheduledFor'), 'handleCreateCase must check body.schedule.scheduledFor');
    assert.ok(api.includes("whatsapp_delivery_status = 'scheduled'"), 'Must update loan_cases delivery status to scheduled');
    assert.ok(api.includes('INSERT INTO schedules'), 'Must insert into schedules table');
    assert.ok(api.includes('INSERT INTO scheduled_occurrences'), 'Must insert into scheduled_occurrences table');
    assert.ok(api.includes("'outreach_scheduled'"), 'Must log outreach_scheduled event to timeline');
  });
});

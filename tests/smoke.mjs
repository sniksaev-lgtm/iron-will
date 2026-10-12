import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const html = fs.readFileSync(new URL("../site/index.html", import.meta.url), "utf8");
let script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1]?.trimEnd();
assert.ok(script, "inline gameplay script must exist");
new Function(script);
script = script.replace("init().catch(function(e){", "window.__iwBoot=init().catch(function(e){");
const ending = "})();";
assert.ok(script.endsWith(ending), "script wrapper ending");
script = script.slice(0, -ending.length) +
  "window.__iwTestApi={get state(){return state},setState:function(v){state=v;render()},makeCampaign:makeCampaign,setForecast:setForecast,enemyTurn:enemyTurn,catchUp:catchUp,registerAction:registerAction,capture:capture,recordHistory:recordHistory,newCampaign:newCampaign,cellCost:cellCost,eligible:eligible,neighbors:neighbors,persist:persist,render:render,validDateKey:validDateKey,syncCalendar:syncCalendar};})();";

class FakeElement {
  constructor(tag = "div") {
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.style = {};
    this.dataset = {};
    this.className = "";
    this.textContent = "";
    this.value = "";
    this.checked = false;
    this.disabled = false;
    this.files = [];
    this.attributes = {};
    this._html = "";
    this.classes = new Set();
    this.classList = {
      add: name => this.classes.add(name),
      remove: name => this.classes.delete(name),
      contains: name => this.classes.has(name),
      toggle: (name, force) => {
        const next = force === undefined ? !this.classes.has(name) : !!force;
        if (next) this.classes.add(name); else this.classes.delete(name);
        return next;
      }
    };
    this.onclick = null;
    this.onsubmit = null;
    this.onchange = null;
  }
  set innerHTML(value) { this._html = value; this.children = []; }
  get innerHTML() { return this._html; }
  appendChild(child) { this.children.push(child); return child; }
  setAttribute(key, value) { this.attributes[key] = value; }
  querySelector(selector) {
    this._query = this._query || {};
    return this._query[selector] || (this._query[selector] = new FakeElement(selector));
  }
  click() { if (this.onclick) this.onclick({ target: this, preventDefault() {} }); }
}

function makeEnvironment(sharedStorage = {}) {
  const ids = [...new Set([...html.matchAll(/id="([^"]+)"/g)].map(match => match[1]))];
  const elements = {};
  ids.forEach(id => elements[id] = new FakeElement(id));
  const tabs = ["map", "actions", "stats", "settings"].map(name => {
    const button = new FakeElement("button");
    button.dataset.tab = name;
    return button;
  });
  const document = {
    body: new FakeElement("body"),
    getElementById: id => elements[id] || (elements[id] = new FakeElement(id)),
    createElement: tag => new FakeElement(tag),
    querySelectorAll: selector => selector === ".tabs button" ? tabs : []
  };
  const localStorage = {
    getItem: key => Object.prototype.hasOwnProperty.call(sharedStorage, key)
      ? sharedStorage[key] : (key === "ironwill-intro" ? "1" : null),
    setItem: (key, value) => { sharedStorage[key] = String(value); },
    removeItem: key => { delete sharedStorage[key]; }
  };
  const window = { addEventListener() {} };
  const context = {
    document, window, navigator: { onLine: true }, location: { protocol: "https:" },
    localStorage, console, setTimeout: () => 1, clearTimeout() {}
  };
  vm.createContext(context);
  vm.runInContext(script, context, { timeout: 5000 });
  return { context, window, document, elements, tabs, storage: sharedStorage, localStorage };
}

function check(condition, message) { assert.ok(condition, message); }
function key(date) {
  return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
}
function connectedCells(api, campaign, owner) {
  api.setState(campaign);
  const wanted = campaign.cells.filter(cell => cell.owner === owner).map(cell => cell.id);
  if (!wanted.length) return false;
  const seen = new Set([wanted[0]]);
  const queue = [wanted[0]];
  while (queue.length) {
    const current = queue.shift();
    for (const next of api.neighbors(current)) {
      if (campaign.cells[next].owner === owner && !seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return seen.size === wanted.length;
}

const checks = [];
const storage = {};
const env = makeEnvironment(storage);
await env.window.__iwBoot;
const api = env.window.__iwTestApi;
const today = key(new Date());

check([144, 256, 400].includes(api.state.cells.length), "first launch chooses a supported random map size");
check(env.elements.map.children.length === api.state.cells.length, "all generated cells render");
check(env.tabs.every(tab => typeof tab.onclick === "function"), "all four tabs have handlers");
checks.push("First launch and navigation");

for (const size of [12, 16, 20]) {
  const first = api.makeCampaign(size, 1, "2026-10-12", 123456);
  const second = api.makeCampaign(size, 1, "2026-10-12", 123456);
  check(first.cells.length === size * size, "correct cell count for size " + size);
  check(JSON.stringify(first.cells) === JSON.stringify(second.cells), "same seed reproduces map " + size);
  check(first.cells.filter(cell => cell.special === "supply").length === 1, "exactly one supply depot");
  check(first.cells.filter(cell => cell.special === "watchtower").length === 1, "exactly one watchtower");
  check(connectedCells(api, first, "player"), "player starting territory is connected");
  check(connectedCells(api, first, "enemy"), "enemy starting territory is connected");
  check(first.cells.some(cell => cell.owner === "neutral"), "neutral front exists");
}
checks.push("Map sizes, seeded reproducibility, special sites and start connectivity");

api.setState(api.makeCampaign(12, 2, today, 222));
api.setForecast();
check(api.registerAction("Test study", "Учёба", 2, null) === true, "first custom action allowed");
check(api.registerAction("Test study", "Учёба", 2, null) === true, "second custom action allowed");
check(api.registerAction("Test study", "Учёба", 2, null) === true, "third custom action allowed");
check(api.registerAction("Test study", "Учёба", 2, null) === false, "fourth identical custom action is blocked");
check(api.state.points === 6, "only accepted actions grant points");
checks.push("Action rewards and anti-farming cap");

const legal = api.makeCampaign(12, 3, today, 333);
api.setState(legal);
api.setForecast();
const target = legal.cells.find(cell => cell.owner === "neutral" && cell.terrain === "plain" && !cell.fort && api.neighbors(cell.id).some(index => legal.cells[index].owner === "player"));
check(!!target, "generated map has an affordable adjacent capture");
legal.points = 3;
const initialPlayerCells = legal.cells.filter(cell => cell.owner === "player").length;
const captureCost = api.cellCost(target);
api.capture(target.id);
check(target.owner === "player", "legal adjacent cell was captured");
check(legal.points === 3 - captureCost, "capture charges exactly its cost");
check(legal.cells.filter(cell => cell.owner === "player").length === initialPlayerCells + 1, "capture adds one cell");
api.capture(target.id);
check(legal.points === 3 - captureCost, "captured cell cannot be charged again");
checks.push("Capture legality, cost and duplicate-use protection");

const diagonal = api.makeCampaign(12, 4, today, 444);
diagonal.cells.forEach(cell => { cell.owner = "neutral"; cell.fort = 0; cell.special = null; });
diagonal.cells[0].owner = "player";
diagonal.cells[diagonal.size * diagonal.size - 1].owner = "enemy";
diagonal.points = 4;
api.setState(diagonal);
api.capture(diagonal.size + 1);
check(diagonal.cells[diagonal.size + 1].owner === "neutral", "diagonal-only target stays neutral");
check(diagonal.points === 4, "invalid capture spends no points");
checks.push("Diagonal capture blocked");

const supply = api.makeCampaign(12, 5, today, 555);
api.setState(supply);
api.setForecast();
const depot = supply.cells.find(cell => cell.special === "supply");
api.neighbors(depot.id).slice(0, 1).forEach(index => { supply.cells[index].owner = "player"; });
supply.points = 10;
const depotCost = api.cellCost(depot);
api.capture(depot.id);
check(depot.owner === "player" && supply.claimedSites.includes("supply"), "supply depot gets recorded");
check(supply.points === 10 - depotCost + 2, "supply bonus grants exactly two points");
depot.owner = "enemy";
supply.points = 10;
api.capture(depot.id);
check(supply.points === 10 - depotCost, "supply bonus cannot be farmed by recapture");
checks.push("One-time supply bonus");

const standard = api.makeCampaign(12, 6, today, 666);
standard.difficulty = "standard";
api.setState(standard);
api.setForecast();
const enemyBefore = standard.cells.filter(cell => cell.owner === "enemy").length;
const playerBefore = standard.cells.filter(cell => cell.owner === "player").length;
api.enemyTurn(key(new Date(Date.now() + 86400000)));
const enemyGained = standard.cells.filter(cell => cell.owner === "enemy").length - enemyBefore;
const playerLost = playerBefore - standard.cells.filter(cell => cell.owner === "player").length;
check(enemyGained <= 8, "standard enemy turn respects total limit");
check(playerLost === 0, "enemy doesn't raid distant non-front player cells");
check(standard.day === 2 && standard.points === 0, "enemy turn advances calendar and clears points");
checks.push("Enemy phases and standard daily cap");

const hard = api.makeCampaign(12, 7, today, 777);
hard.cells.forEach(cell => { cell.owner = "neutral"; cell.fort = 0; cell.special = null; cell.terrain = "plain"; });
hard.cells[0].owner = "player";
hard.cells[1].owner = "enemy";
hard.difficulty = "hard";
hard.points = 9;
api.setState(hard);
api.setForecast();
const hardEnemiesBefore = hard.cells.filter(cell => cell.owner === "enemy").length;
api.enemyTurn(key(new Date(Date.now() + 86400000)));
const hardEnemiesGained = hard.cells.filter(cell => cell.owner === "enemy").length - hardEnemiesBefore;
const hardPlayerLoss = hard.lost;
check(hardEnemiesGained <= 10, "hard enemy never exceeds 10 cells per turn");
check(hardPlayerLoss <= 2, "hard raid has at most two player-cell losses");
check(hard.points === 0, "enemy turn consumes leftover daily points");
checks.push("Hard-mode total cap and raid cap");

const locked = api.makeCampaign(12, 10, today, 1010);
api.setState(locked);
api.setForecast();
const blockedTarget = locked.cells.find(cell => cell.owner === "neutral" && cell.terrain === "plain" && !cell.fort && api.neighbors(cell.id).some(index => locked.cells[index].owner === "player"));
check(!!blockedTarget, "test map must have a legal target before closing the phase");
locked.points = 3;
env.elements.finishday.click();
env.elements.modalok.click();
check(locked.phaseEnded === true, "finish-day confirmation closes the player phase");
check(api.registerAction("Locked phase test", "Учёба", 1, null) === false, "actions are rejected after phase close");
const pointsAfterEnd = locked.points;
check(pointsAfterEnd === 0, "ending the phase clears unused points");
api.capture(blockedTarget.id);
check(blockedTarget.owner === "neutral" && locked.points === pointsAfterEnd, "capture cannot happen after phase close");
api.enemyTurn(key(new Date(Date.now() + 86400000)));
check(locked.phaseEnded === false, "enemy turn reopens next day's player phase");
checks.push("End-day lock and next-day unlock");

const history = api.makeCampaign(12, 8, today, 888);
history.actions = [{ name: "Current test", date: today, category: "Учёба", reward: 2 }];
history.campaignActionStart = 0;
api.setState(history);
api.recordHistory(false);
check(history.history[0].actions === 1, "history stores campaign-specific action count");
const historicOwner = history.history[0].snapshot[0].owner;
history.cells[0].owner = historicOwner === "player" ? "enemy" : "player";
check(history.history[0].snapshot[0].owner === historicOwner, "historical board snapshot is immutable");
checks.push("Campaign history snapshot integrity");

const rollover = api.makeCampaign(12, 9, today, 999);
rollover.actions = [{ name: "Older record", date: today, category: "Спорт", reward: 1 }];
rollover.history = [];
api.setState(rollover);
api.newCampaign(false);
check(api.state.campaignActionStart === 1, "campaign action boundary follows lifetime journal");
check(api.state.campaignActiveDays.length === 0, "new campaign resets campaign activity days");
check(api.state.actions.length === 1, "new campaign preserves lifetime journal");
checks.push("New campaign lifecycle and lifetime log");

api.state.lastDay = today;
await api.persist();
const reloaded = makeEnvironment(storage);
await reloaded.window.__iwBoot;
check(reloaded.window.__iwTestApi.state.actions.length === 1, "saved action journal survives reload");
check([144, 256, 400].includes(reloaded.window.__iwTestApi.state.cells.length), "saved map survives reload");
checks.push("Local save / reload");

// Backups must use real calendar dates, not merely date-shaped strings.
check(api.validDateKey("2026-10-12"), "valid calendar date accepted");
check(!api.validDateKey("2026-99-99") && !api.validDateKey("not-a-date"), "invalid calendar dates rejected");
checks.push("Calendar date validation");

// Returning after a missed date must resolve the enemy turn while the app stays open.
const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);
const missedDay = api.makeCampaign(12, 20, key(yesterday), 202020);
missedDay.lastDay = key(yesterday);
missedDay.day = 2;
missedDay.points = 3;
api.setState(missedDay);
await api.syncCalendar();
check(api.state.lastDay === today, "focus sync advances to current local date");
check(api.state.day === 3 && api.state.points === 0, "missed enemy turn runs once and clears old points");
checks.push("Live calendar sync");

// If an entire campaign ended while away, retain the result and display a report.
const missedWeek = api.makeCampaign(12, 21, key(yesterday), 212121);
missedWeek.lastDay = key(yesterday);
missedWeek.day = 7;
missedWeek.history = [];
missedWeek.actions = [];
api.setState(missedWeek);
api.catchUp();
check(api.state.number === 22, "one new campaign starts after missed week");
check(api.state.history.length === 1, "missed campaign result retained in history");
check(env.elements.modaltitle.textContent === "Сводка за время отсутствия", "missed-week report shown");
checks.push("Missed-week summary and rollover");

console.log("Iron Will smoke checks passed: " + checks.length);
for (const item of checks) console.log("PASS: " + item);

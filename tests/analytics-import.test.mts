// Run with: npm test
import test from "node:test";
import assert from "node:assert/strict";
import { parseCsv } from "../src/lib/analytics/csv.ts";
import { parseDate, parseMoney, inferDayFirst } from "../src/lib/analytics/values.ts";
import { detectChannel, foreignCurrencies, parseExport } from "../src/lib/analytics/importers.ts";

const AIRBNB = `Date,Arriving by date,Type,Confirmation code,Booking date,Start date,End date,Nights,Shortname,Guest,Listing,Details,Reference code,Currency,Amount,Paid out,Service fee,Fast pay fee,Cleaning fee,Gross earnings,Occupancy taxes,Earnings year
09/03/2026,09/04/2026,Payout,,,,,,,,,"Transfer to PayPal: m••••s@yahoo.com (USD)",,USD,,162.59,,,,,,
09/03/2026,,Reservation,HM9WCWN4B3,08/20/2026,09/02/2026,09/07/2026,5,,John Lester,"2BR Villa Center Steps to DMall |Station 2|8-10 Px",,,PHP,"20,238.87",,703.69,,499.00,"20,867.15",412.21,2026
09/03/2026,,Co-Host payout,HM9WCWN4B3,,09/02/2026,09/07/2026,5,,John Lester,"2BR Villa Center Steps to DMall |Station 2|8-10 Px",,,PHP,"-10,119.44",,,,0.00,,0.00,2026
09/01/2026,,Resolution Adjustment,HM25KP42WS,,08/24/2026,08/30/2026,6,,Josh Heng,"2BR Villa Center Steps to DMall |Station 2|8-10 Px",Resolution adjustment for resolution 1788,,PHP,"-3,000.00",,,,,"-3,000.00",,2026
09/01/2026,,Cancellation Fee,HMREY3Q99T,,08/30/2026,08/31/2026,1,,Jaya May,Big 1BR Queen Bed City View,,,PHP,-3114.71,,0,,0,,0,2026
09/01/2026,,Cancellation Fee Refund,HMREY3Q99T,,08/30/2026,08/31/2026,1,,Jaya May,Big 1BR Queen Bed City View,,,PHP,3114.71,,0,,0,,0,2026
08/15/2026,,Reservation,HMCNY00001,,08/14/2026,08/16/2026,2,,Li Wei,Big 1BR Queen Bed City View,,,CNY,500.00,,10.00,,,510.00,,2026
`;

test("CSV: quotes, escaped quotes, CRLF, BOM and semicolons", () => {
  assert.deepEqual(parseCsv('﻿a,b\r\n"1,2","say ""hi"""\r\n'), [["a", "b"], ["1,2", 'say "hi"']]);
  assert.deepEqual(parseCsv("a;b\n1;2\n\n"), [["a", "b"], ["1", "2"]]);
  assert.deepEqual(parseCsv('a,b\n"line\nbreak",x'), [["a", "b"], ["line\nbreak", "x"]]);
});

test("money: separators, symbols, codes and negatives", () => {
  assert.deepEqual(parseMoney("1,234.56"), { value: 1234.56, currency: null });
  assert.deepEqual(parseMoney("₱12,500"), { value: 12500, currency: "PHP" });
  assert.deepEqual(parseMoney("4,500.00 PHP"), { value: 4500, currency: "PHP" });
  assert.deepEqual(parseMoney("PHP -250.5"), { value: -250.5, currency: "PHP" });
  assert.equal(parseMoney("(250.00)")?.value, -250);
  assert.equal(parseMoney("1.234,56 EUR")?.value, 1234.56);
  assert.equal(parseMoney("12,5")?.value, 12.5);
  assert.equal(parseMoney("1,234,567")?.value, 1234567);
  assert.equal(parseMoney(""), null);
  assert.equal(parseMoney("n/a"), null);
});

test("dates: ISO, US, day-first and month names", () => {
  assert.equal(parseDate("2026-09-01"), "2026-09-01");
  assert.equal(parseDate("2026-09-01 14:00:00"), "2026-09-01");
  assert.equal(parseDate("09/01/2026"), "2026-09-01");
  assert.equal(parseDate("09/01/2026", true), "2026-01-09");
  assert.equal(parseDate("Sep 1, 2026"), "2026-09-01");
  assert.equal(parseDate("1 September 2026"), "2026-09-01");
  assert.equal(parseDate("01-Sep-26"), "2026-09-01");
  assert.equal(parseDate("31/02/2026", true), null);
  assert.equal(inferDayFirst(["01/02/2026", "25/03/2026"]), true);
  assert.equal(inferDayFirst(["01/02/2026", "03/25/2026"]), false);
});

test("Airbnb transaction history: detected and normalised", () => {
  const r = parseExport(AIRBNB);
  assert.equal(r.ok, true, r.error);
  assert.equal(r.channel, "airbnb");
  assert.equal(r.rows.length, 7);

  const kinds = r.rows.map((x) => x.kind);
  assert.deepEqual(kinds, ["payout", "booking", "cohost", "resolution", "cancellation", "cancellation", "booking"]);

  const booking = r.rows[1];
  assert.equal(booking.amount, 20238.87);
  assert.equal(booking.checkIn, "2026-09-02");
  assert.equal(booking.checkOut, "2026-09-07");
  assert.equal(booking.nights, 5);
  assert.equal(booking.serviceFee, 703.69);
  assert.equal(booking.cleaningFee, 499);
  assert.equal(booking.gross, 20867.15);

  const payout = r.rows[0];
  assert.equal(payout.amount, 0);
  assert.equal(payout.paidOut, 162.59);
  assert.equal(payout.listing, null);

  // Payout currency (USD) doesn't need converting; the CNY booking does.
  assert.deepEqual(foreignCurrencies(r), ["CNY"]);
  assert.equal(r.periodStart, "2026-08-15");
  assert.equal(r.periodEnd, "2026-09-03");
  assert.equal(r.listings.length, 2);
});

test("Airbnb: fee + refund pair nets to zero and keys are stable across uploads", () => {
  const a = parseExport(AIRBNB);
  const b = parseExport(AIRBNB);
  assert.deepEqual(a.rows.map((x) => x.dedupeKey), b.rows.map((x) => x.dedupeKey));
  assert.equal(new Set(a.rows.map((x) => x.dedupeKey)).size, a.rows.length);
  const cancel = a.rows.filter((x) => x.kind === "cancellation").reduce((s, x) => s + x.amount, 0);
  assert.equal(Math.round(cancel * 100), 0);
});

test("Airbnb: identical ledger rows in one file stay distinct", () => {
  const header = AIRBNB.split("\n")[0];
  const line = "09/01/2026,,Adjustment,HMX,,,,,,,Listing A,,,PHP,-100,,,,,,,2026";
  const r = parseExport([header, line, line].join("\n"));
  assert.equal(r.rows.length, 2);
  assert.notEqual(r.rows[0].dedupeKey, r.rows[1].dedupeKey);
});

const BOOKING_COM = `Book number,Booked by,Guest name(s),Check-in,Check-out,Booked on,Status,Rooms,Persons,Price,Commission %,Commission amount,Payment status,Unit type,Duration (nights)
4721938811,"Santos, Ana",Ana Santos,2026-10-03,2026-10-05,2026-09-20 11:02:13,ok,1,2,"4,500 PHP",15,675 PHP,Paid online,Deluxe Studio,2
4721938812,Lee Kim,Lee Kim,2026-10-10,2026-10-13,2026-09-28 08:00:00,cancelled_by_guest,1,2,"6,000 PHP",15,0 PHP,,Deluxe Studio,3
4721938813,Mark Cruz,Mark Cruz,2026-10-20,2026-10-21,2026-10-01 09:30:00,ok,1,1,"2,200 PHP",15,330 PHP,,Family Room,1
`;

test("Booking.com reservations export: net = price − commission, cancellations skipped", () => {
  assert.equal(detectChannel(BOOKING_COM.split("\n")[0].split(",")), "booking");
  const r = parseExport(BOOKING_COM);
  assert.equal(r.ok, true, r.error);
  assert.equal(r.channel, "booking");
  assert.equal(r.rows.length, 2);
  assert.equal(r.rows[0].amount, 3825);
  assert.equal(r.rows[0].serviceFee, 675);
  assert.equal(r.rows[0].nights, 2);
  assert.equal(r.rows[0].listing, "Deluxe Studio");
  assert.equal(r.rows[0].date, "2026-09-20");
  assert.equal(r.rows[0].currency, "PHP");
  assert.deepEqual(r.skipped, [{ reason: "Cancelled / no-show (not counted)", count: 1 }]);
});

test("Booking.com: a re-export with a changed price keeps the same key", () => {
  const before = parseExport(BOOKING_COM);
  const after = parseExport(BOOKING_COM.replace('"4,500 PHP"', '"5,000 PHP"'));
  assert.equal(before.rows[0].dedupeKey, after.rows[0].dedupeKey);
  assert.equal(after.rows[0].amount, 4325);
});

const AGODA = `Booking ID,Guest Name,Room Type,Check-in,Check-out,Booked Date,Status,Currency,Sell Inclusive,Net Rate
1287765,Juan Dela Cruz,Superior Double,25/10/2026,27/10/2026,02/10/2026,Confirmed,PHP,5200.00,4420.00
1287766,Maria Lopez,Superior Double,03/11/2026,04/11/2026,10/10/2026,Cancelled,PHP,2600.00,0
`;

test("Agoda booking list: uses net rate and reads day-first dates", () => {
  const r = parseExport(AGODA);
  assert.equal(r.ok, true, r.error);
  assert.equal(r.channel, "agoda");
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0].amount, 4420);
  assert.equal(r.rows[0].gross, 5200);
  assert.equal(r.rows[0].checkIn, "2026-10-25");
  assert.equal(r.rows[0].checkOut, "2026-10-27");
  assert.equal(r.rows[0].nights, 2);
});

test("unknown layout asks for a channel, then imports with a manual mapping", () => {
  const csv = `Ref,Name,From,To,Payout\nA1,Ana,2026-10-01,2026-10-04,"9,000"\n`;
  const first = parseExport(csv);
  assert.equal(first.ok, false);
  assert.equal(first.channel, null);
  assert.deepEqual(first.headers, ["Ref", "Name", "From", "To", "Payout"]);

  const r = parseExport(csv, {
    channel: "other",
    defaultListing: "Beach House",
    mapping: { code: "Ref", guest: "Name", checkIn: "From", checkOut: "To", amount: "Payout" },
  });
  assert.equal(r.ok, true, r.error);
  assert.equal(r.rows[0].amount, 9000);
  assert.equal(r.rows[0].nights, 3);
  assert.equal(r.rows[0].listing, "Beach House");
});

test("Booking.com file missing price columns reports what to map", () => {
  const r = parseExport(`Book number,Check-in,Check-out\n1,2026-10-01,2026-10-02\n`);
  assert.equal(r.ok, false);
  assert.equal(r.channel, "booking");
  assert.deepEqual(r.missing, ["amount"]);
});

test("a header row below a title line is found", () => {
  const r = parseExport("Earnings report for Jan–Sep\n" + AIRBNB);
  assert.equal(r.ok, true, r.error);
  assert.equal(r.rows.length, 7);
});

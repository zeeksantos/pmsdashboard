import { test } from "node:test";
import assert from "node:assert/strict";
import { parseExport } from "../src/lib/analytics/importers.ts";
import { buildUpcoming } from "../src/lib/analytics/upcoming.ts";

const PENDING = `Date,Type,Confirmation code,Booking date,Start date,End date,Nights,Guest,Listing,Details,Reference code,Currency,Amount,Service fee,Cleaning fee,Gross earnings,Airbnb remitted tax,Earnings year
11/11/2026,Reservation,HM1,10/10/2026,11/08/2026,11/11/2026,3,Ana,Studio | D'mall ,,,PHP,5405.46,991.54,400.00,6397.00,0.00,
11/20/2026,Reservation,HM2,10/18/2026,11/16/2026,11/20/2026,4,Ben,"Balcony | D’Mall
",,,PHP,8132.28,"1,491.72",400.00,9624.00,0.00,
03/20/2027,Reservation,HM3,10/01/2026,02/21/2027,03/20/2027,27,Cy,"Balcony | D’Mall
",,,PHP,58941.22,"10,811.70",400.00,69752.92,0.00,
`;

test("Airbnb pending export is recognised and keyed apart from paid lines", () => {
  const r = parseExport(PENDING);
  assert.equal(r.ok, true);
  assert.equal(r.channel, "airbnb");
  assert.equal(r.pending, true);
  assert.equal(r.rows.length, 3);
  assert.deepEqual(r.listings, ["Balcony | D’Mall", "Studio | D'mall"]);
  assert.equal(r.rows[1].listing, "Balcony | D’Mall");
  assert.equal(r.rows[1].checkIn, "2026-11-16");
  assert.equal(r.rows[1].serviceFee, 1491.72);
  // same booking with a moved payout date keeps the same key
  const moved = parseExport(PENDING.replace("11/11/2026,Reservation", "11/12/2026,Reservation"));
  assert.equal(moved.rows[0].dedupeKey, r.rows[0].dedupeKey);
});

test("a paid Transaction history export is not pending", () => {
  const paid = `Date,Arriving by date,Type,Confirmation code,Booking date,Start date,End date,Nights,Guest,Listing,Details,Reference code,Currency,Amount,Paid out,Service fee,Fast pay fee,Cleaning fee,Gross earnings,Occupancy taxes,Earnings year
11/11/2026,11/12/2026,Reservation,HM1,10/10/2026,11/08/2026,11/11/2026,3,Ana,Studio,,,PHP,5405.46,,991.54,,400.00,6397.00,,2026
`;
  const r = parseExport(paid);
  assert.equal(r.ok, true);
  assert.equal(r.pending, false);
});

test("upcoming view splits nights and money across months from today", () => {
  const r = parseExport(PENDING);
  const listings = r.listings.map((n, i) => ({ id: `L${i}`, external_name: n, unit_id: n.startsWith("Studio") ? "U1" : null }));
  const lid = new Map(listings.map((l) => [l.external_name, l.id]));
  const u = buildUpcoming({
    today: "2026-11-10",
    units: [{ id: "U1", name: "Room 8", nickname: null, building: "Bori", area: "Boracay", archived: false }],
    listings,
    transactions: r.rows.map((x, i) => ({
      id: String(i),
      kind: x.kind,
      txn_date: x.date,
      confirmation_code: x.code,
      guest_name: x.guest,
      check_in: x.checkIn,
      check_out: x.checkOut,
      nights: x.nights,
      booked_on: x.bookedOn,
      amount_base: x.amount,
      gross: x.gross,
      cleaning_fee: x.cleaningFee,
      fx_rate: 1,
      listing_id: lid.get(x.listing!) ?? null,
    })),
  });
  assert.equal(u.count, 3);
  assert.equal(u.nights, 34);
  assert.equal(Math.round(u.net * 100) / 100, 72478.96);
  assert.deepEqual(u.months, ["2026-11", "2026-12", "2027-01", "2027-02", "2027-03"]);
  assert.equal(u.monthLabels[0], "Nov '26");
  // HM1 is staying tonight (Nov 8–11), HM2 upcoming
  assert.equal(u.stayingNow, 1);
  assert.equal(u.stays[0].status, "staying");
  // Feb 21 → Mar 20: 8 nights in Feb, 19 in Mar
  assert.equal(u.monthly.nights[3], 8);
  assert.equal(u.monthly.nights[4], 19);
  assert.equal(u.monthAvail[0], 21); // Nov 10–30
  // only the linked listing is a unit; the other is shown by listing name
  assert.equal(u.unlinked, 1);
  const room = u.groups.find((g) => g.unitId === "U1")!;
  assert.equal(room.monthNights[0], 1); // only the night of Nov 10 is still ahead
  assert.equal(u.next30.nights, 1 + 4);
});

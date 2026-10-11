import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addPlace,
  gpsClusters,
  joinPlaces,
  MAX_PLACES,
  placeFromReverse,
  placesFromSearch,
  tripPlace,
  withDraft,
  type PhotonFeature,
} from "./places-format";

const f = (lng: number, lat: number, properties: PhotonFeature["properties"]): PhotonFeature => ({
  geometry: { coordinates: [lng, lat] },
  properties,
});

describe("places", () => {
  it("turns Photon results into short names with a province line, dropping roads and old boundaries", () => {
    const places = placesFromSearch([
      f(108.438, 11.94, { name: "Đà Lạt", county: "Phường Xuân Hương - Đà Lạt", state: "Lâm Đồng", country: "Việt Nam", countrycode: "VN", osm_key: "place", osm_value: "city" }),
      f(108.457, 11.908, { name: "Thành phố Đà Lạt", state: "Lâm Đồng", countrycode: "VN", osm_key: "boundary", osm_value: "historic" }),
      f(108.45, 11.94, { name: "Đường cao tốc", state: "Lâm Đồng", countrycode: "VN", osm_key: "highway", osm_value: "motorway" }),
      f(100.494, 13.752, { name: "กรุงเทพมหานคร", country: "ประเทศไทย", countrycode: "TH", osm_key: "place", osm_value: "city" }),
      f(106.699, 10.779, { name: "Nhà thờ Đức Bà Sài Gòn", city: "Thành phố Hồ Chí Minh", state: "Thành phố Hồ Chí Minh", countrycode: "VN", osm_key: "amenity" }),
    ]);
    assert.deepEqual(places, [
      { name: "Đà Lạt", detail: "Lâm Đồng", lat: 11.94, lng: 108.438 },
      // Trong nước đứng trước nước ngoài
      { name: "Nhà thờ Đức Bà Sài Gòn", detail: "Thành phố Hồ Chí Minh", lat: 10.779, lng: 106.699 },
      { name: "กรุงเทพมหานคร", detail: "ประเทศไทย", lat: 13.752, lng: 100.494 },
    ]);
  });

  it("puts Vietnamese named places first, then other spots, abroad after, and ward-level areas last", () => {
    const vn = { state: "Lâm Đồng", countrycode: "VN" };
    const places = placesFromSearch([
      f(98.5, 13.9, { name: "Da La Shaung", country: "Myanmar", countrycode: "MM", osm_key: "place", osm_value: "village" }),
      f(108.43, 11.95, { name: "Da Lat", ...vn, osm_key: "amenity", osm_value: "cafe" }),
      f(108.44, 11.9, { name: "Phường Xuân Hương - Đà Lạt", ...vn, osm_key: "boundary", osm_value: "administrative" }),
      f(108.44, 11.94, { name: "Đà Lạt", ...vn, osm_key: "place", osm_value: "city" }),
      f(108.45, 11.94, { name: "Ga Đà Lạt", ...vn, osm_key: "railway" }),
    ]);
    assert.deepEqual(
      places.map((p) => p.name),
      ["Đà Lạt", "Da Lat", "Ga Đà Lạt", "Da La Shaung", "Phường Xuân Hương - Đà Lạt"],
    );
  });

  it("drops duplicates and features without a name or coordinates", () => {
    const hoiAn = { name: "Hội An", state: "Đà Nẵng", countrycode: "VN", osm_key: "place" };
    const places = placesFromSearch([f(108.33, 15.88, hoiAn), f(108.31, 15.89, hoiAn), f(1, 1, { countrycode: "VN" }), { properties: hoiAn }]);
    assert.equal(places.length, 1);
  });

  it("names a GPS point by its city, not the nearest street", () => {
    const street = { name: "Hùng Vương", city: "Đà Lạt", county: "Phường Xuân Hương - Đà Lạt", state: "Lâm Đồng", countrycode: "VN" };
    assert.deepEqual(placeFromReverse([f(108.4583, 11.9404, street)], { lat: 11.940412, lng: 108.458301 }), {
      name: "Đà Lạt",
      detail: "Lâm Đồng",
      lat: 11.94041,
      lng: 108.4583,
    });
    // Không có thành phố → bỏ cấp phường / xã, lấy tỉnh
    const rural = { name: "Đường mòn", county: "Xã Tả Van", state: "Lào Cai", countrycode: "VN" };
    assert.equal(placeFromReverse([f(103.84, 22.31, rural)], { lat: 22.31, lng: 103.84 })?.name, "Lào Cai");
    assert.equal(placeFromReverse([], { lat: 0, lng: 0 }), null);
    // Thành phố gần nhất (sau sáp nhập 2025 Hội An thuộc TP Đà Nẵng, nhưng tên chuyến vẫn là "Hội An")
    const hoiAn = { name: "Hội An", state: "Đà Nẵng", countrycode: "VN", osm_key: "place", osm_value: "city" };
    assert.deepEqual(placeFromReverse([f(108.3305, 15.8798, hoiAn)], { lat: 15.877, lng: 108.326 }), {
      name: "Hội An",
      detail: "Đà Nẵng",
      lat: 15.8798,
      lng: 108.3305,
    });
  });

  it("groups photo GPS points into the busiest few areas", () => {
    const daLat = Array.from({ length: 5 }, (_, i) => ({ lat: 11.94 + i * 0.001, lng: 108.44 }));
    const nhaTrang = [{ lat: 12.24, lng: 109.19 }, { lat: 12.241, lng: 109.191 }];
    const clusters = gpsClusters([...nhaTrang, ...daLat, { lat: 0, lng: 0 }, { lat: Number.NaN, lng: 1 }]);
    assert.deepEqual(
      clusters.map((c) => c.count),
      [5, 2],
    );
    assert.equal(clusters[0].lat, 11.942);
  });
});

describe("trip places", () => {
  const daLat = tripPlace({ name: " Đà Lạt ", lat: 11.94, lng: 108.44 });

  it("joins names for display and keeps coordinates only when picked", () => {
    assert.deepEqual(daLat, { name: "Đà Lạt", lat: 11.94, lng: 108.44 });
    assert.deepEqual(tripPlace({ name: "Nhà bà ngoại" }), { name: "Nhà bà ngoại", lat: null, lng: null });
    assert.equal(joinPlaces([daLat, tripPlace({ name: "Nha Trang" })]), "Đà Lạt, Nha Trang");
  });

  it("adds places without blanks, duplicates (any case) or going past the limit", () => {
    let list = addPlace([], daLat);
    list = addPlace(list, tripPlace({ name: "đà lạt" }));
    list = addPlace(list, tripPlace({ name: "   " }));
    assert.equal(list.length, 1);
    const full = Array.from({ length: MAX_PLACES }, (_, i) => tripPlace({ name: `P${i}` }));
    assert.equal(addPlace(full, tripPlace({ name: "One more" })), full);
  });

  it("keeps a half-typed place when saving", () => {
    assert.deepEqual(withDraft([daLat], " Mũi Né "), [daLat, { name: "Mũi Né", lat: null, lng: null }]);
    assert.deepEqual(withDraft([daLat], ""), [daLat]);
  });
});

const map = L.map("map", {
  center: [7.301871, 5.134118],
  zoom: 19,
  minZoom: 14,
});

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution:
    'Map data © <a href="https://openstreetmap.org">OpenStreetMap</a> contributors',
}).addTo(map);

let marker;
map.on("click", async function (e) {
  const { lat, lng } = e.latlng;

  document.getElementById("lat").value = lat;
  document.getElementById("lng").value = lng;

  if (marker) {
    marker.setLatLng(e.latlng);
  } else {
    marker = L.marker(e.latlng).addTo(map);
  }

  // reverse geocoding using Nominatim
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`
    );
    const data = await response.json();

    const displayName = data.display_name;

    document.querySelector('input[name="custom-location"]').value =
      displayName || "";
  } catch (error) {
    console.error("reverse geocoding failed:", error);
  }
});

// Civil timezone approximation from a longitude.
//
// A birth chart needs an IANA zone, not an offset: the zone decides the local
// wall-clock → UTC instant, and a whole hour of error moves the Lagna by ~15°
// of sidereal time. When no gazetteer match exists we fall back to the mean
// solar zone of the longitude — right for most of the world, and honest about
// being approximate (Etc/GMT* zones have the inverted sign convention).
export function timezoneFromLng(lng: number): string {
  // India spans 68–97°E but runs on a single civil zone.
  if (lng >= 68 && lng <= 97) return "Asia/Kolkata";
  const offsetHours = Math.round(lng / 15);
  if (offsetHours === 0) return "Etc/GMT";
  return `Etc/GMT${offsetHours > 0 ? "-" : "+"}${Math.abs(offsetHours)}`;
}

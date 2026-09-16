// Ortaklık (affiliate) ayarları.
//
// Booking.com Partner Programı ve GetYourGuide Partner Programı'na (ikisi de ücretsiz)
// başvurup onaylandığınızda aşağıdaki iki değeri kendi ID'lerinizle doldurun.
// Boş bıraksanız da linkler çalışır, sadece komisyon size değil ilgili platforma yazılır.
export const AFFILIATE_IDS = {
  // Booking.com Partner Hub > Account > Affiliate ID ("aid" parametresi)
  booking: '',
  // GetYourGuide Partner Portal > Tracking > Partner ID
  getyourguide: '',
};

export function bookingSearchUrl(destinationLabel) {
  const q = encodeURIComponent(destinationLabel || '');
  const aid = AFFILIATE_IDS.booking;
  return `https://www.booking.com/searchresults.html?ss=${q}${aid ? `&aid=${aid}` : ''}`;
}

export function getYourGuideSearchUrl(destinationLabel) {
  const q = encodeURIComponent(destinationLabel || '');
  const pid = AFFILIATE_IDS.getyourguide;
  return `https://www.getyourguide.com/s/?q=${q}${pid ? `&partner_id=${pid}` : ''}`;
}

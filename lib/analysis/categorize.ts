// Merchant-name fallback categorizer. Plaid often returns primary = "OTHER" for
// banks with raw descriptions (e.g. "TST*BELLES", "PURCHASE AUTHORIZED ON ..."),
// which buries real spend. When Plaid is confident we keep its category; when it
// says OTHER/null we infer from the description. Heuristic, not perfect — but far
// better than a giant "Other" bucket.

const RULES: [RegExp, string][] = [
  // money movement (not spending)
  [/\b(ZELLE|VENMO|CASH ?APP|WIRE TRANSFER|ACH TRANSFER|ONLINE TRANSFER|BOOK TRANSFER|BANK TRANSFER)\b/, 'TRANSFER_OUT'],
  // government / taxes
  [/\b(IRS|US TREASURY|TREASURY|DMV|STATE OF|CITY OF|COUNTY OF|FRANCHISE TAX|\bTAX\b|\bORS\b|GOVERNMENT)\b/, 'GOVERNMENT_AND_NON_PROFIT'],
  // food delivery + restaurants (before rideshare so "UBER EATS" wins)
  [/\b(UBER ?EATS|DOORDASH|GRUBHUB|POSTMATES|SEAMLESS|CAVIAR|SLICE)\b/, 'FOOD_AND_DRINK'],
  [/\bTST\s?\*/, 'FOOD_AND_DRINK'], // Toast POS ⇒ restaurant
  [/\b(RESTAURANT|CAFE|COFFEE|ESPRESSO|PIZZA|GRILL|KITCHEN|TAQUERIA|SUSHI|RAMEN|NOODLE|THAI|\bBBQ\b|DELI|BAKERY|BISTRO|EATERY|DINER|BREWERY|BREWING|\bPUB\b|TAVERN|CANTINA|STARBUCKS|CHIPOTLE|MCDONALD|BURGER|\bTACO|WINGS|STEAKHOUSE|SEAFOOD|CREAMERY|GELATO|JUICE|SMOOTHIE|BOBA|\bBAR\b|OYSTER|BRASSERIE|TRATTORIA|IZAKAYA|KOREAN|RAMEN|DUMPLING)\b/, 'FOOD_AND_DRINK'],
  // travel
  [/\b(AIRBNB|VRBO|HOTEL|MOTEL|MARRIOTT|HILTON|HYATT|SHERATON|WESTIN|EXPEDIA|BOOKING\.COM|AIRLINE|AIRLINES|DELTA AIR|UNITED AIR|SOUTHWEST AIR|JETBLUE|ALASKA AIR|AMERICAN AIR|SPIRIT AIR|\bFLIGHT\b|RESORT|LODGE)\b/, 'TRAVEL'],
  // transportation / gas / rideshare / parking
  [/\b(UBER|LYFT|CHEVRON|SHELL OIL|SHELL SERVICE|EXXON|MOBIL|ARCO|VALERO|CITGO|SUNOCO|\bBP\b|GAS STATION|FUEL|PARKING|GARAGE|\bTOLL|METRO|TRANSIT|\bMTA\b|\bBART\b|CALTRAIN|AMTRAK|ENTERPRISE RENT|HERTZ|\bAVIS\b|ZIPCAR)\b/, 'TRANSPORTATION'],
  // gym / personal care
  [/\b(EQUINOX|\bGYM\b|FITNESS|CROSSFIT|\bYOGA\b|PILATES|SALON|\bSPA\b|BARBER|\bNAIL|HAIRCUT|MASSAGE|SOULCYCLE|BARRY'?S)\b/, 'PERSONAL_CARE'],
  // entertainment / streaming
  [/\b(NETFLIX|SPOTIFY|\bHULU\b|DISNEY|\bHBO\b|PARAMOUNT\+|PEACOCK|YOUTUBE|CINEMA|\bAMC\b|THEATER|THEATRE|\bSTEAM\b|XBOX|PLAYSTATION|NINTENDO|PATREON|TWITCH|TICKETMASTER|STUBHUB)\b/, 'ENTERTAINMENT'],
  // shopping / general merchandise
  [/\b(AMAZON|\bAMZN\b|WALMART|TARGET|COSTCO|BEST BUY|BESTBUY|\bEBAY\b|\bETSY\b|MACY|NORDSTROM|\bIKEA\b|HOME DEPOT|LOWES|\bCVS\b|WALGREENS|APPLE STORE|SEPHORA|ULTA|SHEIN|TEMU)\b/, 'GENERAL_MERCHANDISE'],
  // utilities / telecom / rent
  [/\b(AT&T|VERIZON|T-MOBILE|TMOBILE|COMCAST|XFINITY|SPECTRUM|PG&E|CON ?ED|EDISON|ELECTRIC|WATER DEPT|UTILITY|INTERNET|\bRENT\b|PROPERTY MGMT|APARTMENT|LEASING)\b/, 'RENT_AND_UTILITIES'],
  // medical
  [/\b(PHARMACY|HOSPITAL|CLINIC|MEDICAL|DENTAL|DENTIST|DOCTOR|\bHEALTH\b|VISION|OPTOMETRY|URGENT CARE|LABCORP|QUEST DIAG)\b/, 'MEDICAL'],
];

// Categories where Plaid's own answer, if present, should be trusted over rules.
export function inferCategory(text: string, plaidPrimary?: string | null): string {
  if (plaidPrimary && plaidPrimary !== 'OTHER') return plaidPrimary;
  const s = (text || '').toUpperCase();
  for (const [re, cat] of RULES) if (re.test(s)) return cat;
  return plaidPrimary || 'OTHER';
}

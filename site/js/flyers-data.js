// Single source of truth for event-id -> poster-filename mapping, used by both the interactive
// client (site/js/app.js, loaded as a classic script) and the static-site generator
// (scripts/build-site.mjs, which loads this file's source and evaluates it the same way it
// already does for i18n.js -- see build-site.mjs's `appI18n` loading for the identical pattern).
// This used to be hand-duplicated in both files and had already drifted out of sync (build-site.mjs
// was missing ~19 newer mappings app.js had), so static event pages were silently missing images
// the interactive calendar showed. Keep this the only place a new poster gets registered.
//
// Returns just the filename (from FLYERS), or null -- callers apply their own base path via their
// own flyerUrl(name), since app.js and build-site.mjs serve the "2026 Events" folder from
// different relative paths.
const FLYERS = {
  hkdNapredak: "711533429_10238862739681621_7132440665447619987_n.jpg",
  brunoRacki: "726622978_1324662396311754_1196331273202483318_n.jpg",
  fermata: "729089446_1330560095917082_5424991246713228614_n.jpg",
  malaVelaLukaSah: "733810265_1004139169178619_7406030034854469969_n.jpg",
  sinisaVuco: "739965778_3184088421782240_727211797039421734_n.jpg",
  praviPrijatelj: "741439623_1623547135830221_2514987522212171195_n.jpg",
  ekoKlik: "726427451_1622113932189830_4644658454319049907_n.jfif",
  blatskoLjeto: "728951558_2842843536074422_8664357824117296469_n.jfif",
  kulturnoAvgust1: "729080791_2365533420921531_4732103117572546297_n.jfif",
  kulturnoSrpanj1: "729089537_2052799258997320_7966040970482679038_n.jfif",
  kulturnoAvgust2: "729953708_1801545614355331_6875222987793021677_n.jfif",
  kulturnoSrpanj2: "730584727_2758199641242412_4857147205496412772_n.jfif",
  nogometNaPlazi: "731808257_2355501548310712_7501183823000969035_n.jfif",
  hakunaMatata: "741209865_1350510197149943_3713384124144151341_n.jfif",
  lumbarajskeUzance: "WhatsApp Image 2026-07-08 at 22.58.52.jpeg",
  smokviskoLito: "WhatsApp Image 2026-07-08 at 23.01.19.jpeg",
  litoUPostrani: "WhatsApp Image 2026-07-08 at 23.01.33.jpeg",
  dicoHomo: "WhatsApp Image 2026-07-08 at 23.01.40.jpeg",
  luskoLito: "WhatsApp Image 2026-07-08 at 23.01.50.jpeg",
  litoURaciscu: "lito-u-raciscu.jpeg",
  vecerPrsuta: "742480682_122111178783315720_7349343465846962909_n.jpg",
  vecerPrsuta2: "mediteran-prsut-sir-vino-2.jpeg",
  vesnaHariBlato: "vesna-pisarovic-hari-roncevic-blato.jpeg",
  tragUBeskraju: "trag-u-beskraju-2026-program.jpeg",
  zenskiBuce: "racisce-zenski-turnir-buce-2026.jpeg",
  racisceFutsal: "racisce-malonogometni-turnir-2026.jpeg",
  sandraAfrika: "sandra-afrika-the-jungle-korcula-2026.jpg",
  slusaonicaOlivera: "slusaonica-olivera-mediteran-racisce-2026.jpg",
  marendaDivljac: "mediteran-marenda-divljac-njoki.jpeg",
  magazinBlato: "magazin-blato-plokata.jpeg",
  futsalFinale: "racisce-malonogometni-finale-2026.jpeg",
  kolovozRaciscuKalendar: "kolovoz-u-raciscu-kalendar-2026.jpeg",
  pupnatDanMjesta: "pupnat-danmjesta-05082026.jpeg",
  folkloreEveningBlato: "kumpanjija-blato-folklore-evening.jpeg",
  zmajVeterani: "bsk-zmaj-blato-100-godina-veterani.jpeg",
  zmajPetarGraso: "bsk-zmaj-blato-100-godina-petar-graso.jpeg",
  sylviaBatistic: "sylvia-batistic-unutarnji-krajolici.jpeg",
  zrnovskaMakarunada: "zrnovska-makarunada-2026.jpeg",
  knezaRibarska: "kneska-ribarska-vecer-2026.jpeg",
  marendaBakalar: "mediteran-marenda-bakalar-crveno.jpeg",
  zukovicaPredavanje: "racisce-spilja-zukovica-predavanje.jpeg",
  velaLukaFolkloreAug: "vela-luka-folklore-evenings-august.jpeg",
  korculaAroundAugust: "korcula-around-august-calendar.jpeg",
  dancingQueenAbba: "dancing-queen-abba-tribute-korcula.jpeg",
  waterPoloChampionship: "korcula-water-polo-championship-2026.jpeg",
  korculaUpcomingAugust: "korcula-upcoming-events-august-calendar.jpeg",
  ljetoUKnjiznici: "728439557_1484342147071700_1265131594923239365_n.jpg",
  jadranovaNocDivljeJagode: "jadranova-noc-divlje-jagode-2026.jpeg",
  jadranovaNocDivljeJagodeInfo: "jadranova-noc-divlje-jagode-info-2026.jpeg",
  raciscelBuceSlavljenickaVecera: "racisce-buce-slavljenicka-vecera-2026.jpeg",
  marendaTripice: "mediteran-marenda-tripice.jpeg",
  indiraForzaJungle: "jungle-indira-forza-2026.jpeg",
  zrnovskaMakarunadaEn: "zrnovska-makarunada-2026-en.jpeg",
  muskiBuceFinaleRaspored: "racisce-muski-buce-finale-raspored.jpeg",
  arhitekturaKo1525: "korcula-arhitektura-ko15-25-izlozba.jpeg",
  kinoMalciCudovista0811: "kino-malci-cudovista-11082026.jpeg",
  lutkeCvrcakIMrav0810: "lutke-cvrcak-i-mrav-10082026.jpeg",
  alanHrzicaSmokvica: "alan-hrzica-smokvica-2026.jpeg",
  zrnovoPostranaVelaGospaSvRoko: "zrnovo-postrana-vela-gospa-sv-roko-2026.jpeg",
  zrnovoPostranaTotemBend: "zrnovo-postrana-totem-bend-2026.jpeg",
  raciscePumpureleRaspored: "racisce-noc-pumpurele-raspored-2026.jpeg",
  raciscePumpureleRasporedV2: "racisce-noc-pumpurele-raspored-2026-v2.jpeg",
  velaLukaAudicija: "vela-luka-audicija-standup-2026.jpeg",
  jungleConnectLive: "jungle-connect-live-2026.jpeg",
  jungleDaraBubamara: "jungle-dara-bubamara-2026.jpeg",
  blatoSmotraFolkloreLxiii: "blato-smotra-folklora-lxiii-2026.jpeg",
  mediteranRucak0819: "mediteran-rucak-19082026.jpeg",
  raciscelMaloLjetnoKino0821: "racisce-malo-ljetno-kino-21082026.jpeg",
  mediteranHajdukRakow0820: "mediteran-hajduk-rakow-20082026.jpeg",
  zavalaticaRibarskaVecer: "zavalatica-ribarska-vecer-22082026.jpeg",
  standupSkiljo0817: "kt-standup-skiljo-0817-2026.jpeg",
  koncertLimicNeli0825: "kt-koncert-limic-neli-0825-2026.jpeg",
  kulkvizPoster: "kt-kulkviz-poster-2026.jpeg",
  dramaLjudskosti0829: "kt-drama-ljudskosti-0829-2026.jpeg",
  kinoDjecakDupin20824: "kt-kino-djecak-dupin2-0824-2026.jpeg",
  dramaTrudnica0819: "kt-drama-trudnica-0819-2026.jpeg",
  mediteranDalmatinskaNoc0828: "mediteran-dalmatinska-noc-28082026.jpeg",
  korkyraBaroqueProgram: "kt-korkyra-baroque-program-2026.jpeg",
  markopoloGala0906: "kt-markopolo-gala-2026.jpeg",
  swordfestProgram: "kt-swordfest-program-2026.jpeg",
  pupnatViteskiFestival0903: "pupnat-viteski-festival-0903.jpeg",
  festaOdUja0903: "vl-festa-od-uja-0903.jpeg",
  daniMaslinovogUljaProgram: "vl-dani-maslinovog-ulja-program-2026.jpeg",
  brodetijada0905: "smk-brodetijada-2026.jpeg",
  lumbardaFolkloreEveningsWed: "lb-folklorne-veceri-2026.jpeg",
  zrnovoTurnirBucamaZene0904: "zrnovo-turnir-bucama-zene-0904.jpeg",
  zrnovoMalaGospaNapuhanci0905: "zrnovo-mala-gospa-napuhanci-0905.jpeg"
};

const NO_FLYER_IDS = new Set(["kt-brodogradnja","kt-moreska-season","kt-svtodor","kt-winefest","kt-hajduk-istra","kt-hajduk-zalgiris","kt-hajduk-gorica","kt-hajduk-osijek","kt-hajduk-lokomotiva","kt-hajduk-rakow-uzvrat","kt-hajduk-rudes","kt-hajduk-slaven","kt-hajduk-rijeka"]);

// Events with more than one poster/photo worth showing (e.g. a main poster plus a
// separate ticket-info graphic). Keys are event ids, values are FLYERS keys in display
// order. Anything not listed here falls back to resolveFlyerFilename()'s single result.
const MULTI_FLYERS = {
  "smk-jadranova": ["jadranovaNocDivljeJagode", "jadranovaNocDivljeJagodeInfo"],
  "zrnovo-makarunada": ["zrnovskaMakarunada", "zrnovskaMakarunadaEn"],
  "racisce-muski-buce": ["litoURaciscu", "muskiBuceFinaleRaspored"],
  "pst-danmjesta": ["zrnovoPostranaVelaGospaSvRoko", "zrnovoPostranaTotemBend"],
  "racisce-noc-pumpurele": ["litoURaciscu", "raciscePumpureleRaspored", "raciscePumpureleRasporedV2"],
  "kt-swordfest": ["swordfestProgram", "pupnatViteskiFestival0903"],
  "vl-olive-1": ["festaOdUja0903", "daniMaslinovogUljaProgram"]
};

// Always returns an array (possibly empty) -- the plural counterpart to resolveFlyerFilename,
// used wherever a gallery of every poster for an event (not just the primary one) is wanted.
function resolveFlyerFilenames(id, date) {
  if (MULTI_FLYERS[id]) return MULTI_FLYERS[id].map((key) => FLYERS[key]).filter(Boolean);
  const single = resolveFlyerFilename(id, date);
  return single ? [single] : [];
}

function resolveFlyerFilename(id, date) {
  if (id.startsWith("kt-fermata")) return FLYERS.fermata;
  if (id === "kt-dancing-queen-abba") return FLYERS.dancingQueenAbba;
  if (id === "kt-water-polo-championship") return FLYERS.waterPoloChampionship;
  if (id === "kt-dino-dvornik-tribute") return FLYERS.korculaUpcomingAugust;
  if (id === "kt-ljeto-u-knjiznici") return FLYERS.ljetoUKnjiznici;
  if (id === "kt-arch-ko1525") return FLYERS.arhitekturaKo1525;
  if (id === "kt-kino-0811") return FLYERS.kinoMalciCudovista0811;
  if (id === "kt-lutke-0810") return FLYERS.lutkeCvrcakIMrav0810;
  if (id === "kt-standup-0817") return FLYERS.standupSkiljo0817;
  if (id === "kt-koncert-0825") return FLYERS.koncertLimicNeli0825;
  if (id === "kt-kulkviz") return FLYERS.kulkvizPoster;
  if (id === "kt-drama-0829") return FLYERS.dramaLjudskosti0829;
  if (id === "kt-kino-0824") return FLYERS.kinoDjecakDupin20824;
  if (id === "kt-drama-0819") return FLYERS.dramaTrudnica0819;
  if (id === "smk-jadranova") return FLYERS.jadranovaNocDivljeJagode;
  if (id === "smk-duhovni") return FLYERS.alanHrzicaSmokvica;
  if (id === "racisce-buce-slavljenicka-vecera") return FLYERS.raciscelBuceSlavljenickaVecera;
  if (id === "racisce-marenda-tripice") return FLYERS.marendaTripice;
  if (id === "racisce-rucak-mediteranu-0819") return FLYERS.mediteranRucak0819;
  if (id === "racisce-malo-ljetno-kino-0821") return FLYERS.raciscelMaloLjetnoKino0821;
  if (id === "racisce-hajduk-rakow") return FLYERS.mediteranHajdukRakow0820;
  if (id === "zavalatica-ribarska-vecer") return FLYERS.zavalaticaRibarskaVecer;
  if (id === "racisce-dalmatinska-noc") return FLYERS.mediteranDalmatinskaNoc0828;
  if (id === "kt-korkyra-baroque") return FLYERS.korkyraBaroqueProgram;
  if (id === "kt-markopolo-gala") return FLYERS.markopoloGala0906;
  if (id === "kt-swordfest") return FLYERS.swordfestProgram;
  if (id === "smk-brodetijada") return FLYERS.brodetijada0905;
  if (id === "lb-folklorne-veceri") return FLYERS.lumbardaFolkloreEveningsWed;
  if (id === "zrnovo-turnir-bucama-zene") return FLYERS.zrnovoTurnirBucamaZene0904;
  if (id === "zrnovo-mala-gospa-napuhanci") return FLYERS.zrnovoMalaGospaNapuhanci0905;
  if (id === "nl-indira-forza-jungle") return FLYERS.indiraForzaJungle;
  if (id === "pst-danmjesta" || id === "pst-svroko") return FLYERS.zrnovoPostranaVelaGospaSvRoko;
  if (id === "vl-audicija-standup") return FLYERS.velaLukaAudicija;
  if (id === "nl-connect-jungle") return FLYERS.jungleConnectLive;
  if (id === "nl-dara-bubamara-jungle") return FLYERS.jungleDaraBubamara;
  if (id === "blato-smotra-folklora-lxiii") return FLYERS.blatoSmotraFolkloreLxiii;
  if (id.startsWith("kt-") && !NO_FLYER_IDS.has(id)) {
    const month = date.slice(5, 7), day = parseInt(date.slice(8, 10), 10);
    if (month === "07") return day <= 14 ? FLYERS.kulturnoSrpanj1 : FLYERS.kulturnoSrpanj2;
    if (month === "08") return day <= 12 ? FLYERS.kulturnoAvgust1 : FLYERS.kulturnoAvgust2;
    return null;
  }
  if (id === "lb-lutke-ekoklik") return FLYERS.ekoKlik;
  if (id === "lb-lutke-prijatelj" || id === "lb-lutke-0820") return FLYERS.praviPrijatelj;
  if (id === "lb-nogomet") return FLYERS.nogometNaPlazi;
  if (id === "lb-hakuna") return FLYERS.hakunaMatata;
  if (id.startsWith("lb-")) return FLYERS.lumbarajskeUzance;
  if (id === "vl-napredak") return FLYERS.hkdNapredak;
  if (id === "vl-racki") return FLYERS.brunoRacki;
  if (id === "vl-chess-mala") return FLYERS.malaVelaLukaSah;
  if (id === "vl-olive-1") return FLYERS.festaOdUja0903;
  if (id.startsWith("vl-oliver")) return FLYERS.tragUBeskraju;
  if (id.startsWith("vl-folk-")) return FLYERS.velaLukaFolkloreAug;
  if (id.startsWith("vl-")) return FLYERS.luskoLito;
  if (id === "blato-vesna-pisarovic-hari-roncevic") return FLYERS.vesnaHariBlato;
  if (id === "blato-magazin") return FLYERS.magazinBlato;
  if (id === "blato-zlinje-veterani") return FLYERS.zmajVeterani;
  if (id === "blato-petar-graso-domenica") return FLYERS.zmajPetarGraso;
  if (id === "blato-folklore-evening") return FLYERS.folkloreEveningBlato;
  if (id.startsWith("blato-")) return FLYERS.blatskoLjeto;
  if (id.startsWith("smk-")) return FLYERS.smokviskoLito;
  if (id.startsWith("pst-")) return FLYERS.litoUPostrani;
  if (id === "racisce-zenski-buce") return FLYERS.zenskiBuce;
  if (id === "racisce-malonogometni-turnir-finale") return FLYERS.futsalFinale;
  if (id === "racisce-malonogometni-turnir-2026") return FLYERS.racisceFutsal;
  if (id === "racisce-slusaonica-oliver") return FLYERS.slusaonicaOlivera;
  if (id === "racisce-vecer-prsuta-2") return FLYERS.vecerPrsuta2;
  if (id === "racisce-vecer-prsuta") return FLYERS.vecerPrsuta;
  if (id === "racisce-marenda-divljac-njoki") return FLYERS.marendaDivljac;
  if (id === "racisce-marenda-bakalar") return FLYERS.marendaBakalar;
  if (id === "racisce-zukovica-zbornik") return FLYERS.zukovicaPredavanje;
  if (id === "racisce-igre-racica" || id === "racisce-kronike") return FLYERS.kolovozRaciscuKalendar;
  if (id.startsWith("racisce-")) return FLYERS.litoURaciscu;
  if (id === "cara-vuco") return FLYERS.sinisaVuco;
  if (id === "nl-sandra-afrika-jungle") return FLYERS.sandraAfrika;
  if (id.startsWith("rc-")) return FLYERS.dicoHomo;
  if (id === "pupnat-danmjesta") return FLYERS.pupnatDanMjesta;
  if (id === "kneze-ribarska-vecer") return FLYERS.knezaRibarska;
  if (id === "lumbarda-sylvia-batistic") return FLYERS.sylviaBatistic;
  if (id === "zrnovo-makarunada") return FLYERS.zrnovskaMakarunada;
  if (id === "zrnovo-folklore-noc") return FLYERS.korculaAroundAugust;
  return null;
}

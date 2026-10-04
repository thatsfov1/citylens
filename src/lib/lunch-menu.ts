// Easter egg: sending the word "isgudokei" in the landing chat shows the W Starej Kuchni lunch offer instead of calling the
// model. The facts are the restaurant's own standing offer (https://www.wstarejkuchni.pl/, read 2026-10-04). The dishes
// change weekly and are only published on the restaurant's Instagram and Facebook profiles, so none are listed here.

export const LUNCH_TRIGGER = "isgudokei";

/** True when the message contains the trigger word, in any case and with any punctuation around it. */
export function isLunchTrigger(text: string): boolean {
  return new RegExp(`(^|[^\\p{L}\\p{N}])${LUNCH_TRIGGER}($|[^\\p{L}\\p{N}])`, "iu").test(text);
}

export const LUNCH_REPLY = [
  "Lunch w Starej Kuchni (ul. św. Tomasza 8, Kraków)",
  "",
  "• 46 zł: zupa, danie główne i domowy kompot",
  "• trzy zupy do wyboru i cztery dania główne, w tym zawsze jedno wegetariańskie",
  "• od poniedziałku do piątku, 12:00–15:00",
  "• zupę lub danie główne można też kupić osobno",
  "",
  "Aktualne dania restauracja publikuje w każdy poniedziałek na swoim Instagramie i Facebooku, więc nie podaję ich tutaj.",
  "Źródło: wstarejkuchni.pl",
].join("\n");

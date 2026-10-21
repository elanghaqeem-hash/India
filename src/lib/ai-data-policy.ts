/** INDIA outbound AI policy: never send common customer identifiers to third-party models. */
const email=/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const mobile=/(?:^|\D)(?:\+?62[\s.-]*|0)8\d[\d\s().-]{7,}(?=\D|$)/;
const formattedTaxId=/(?:^|\D)\d{2}\.\d{3}\.\d{3}\.\d[- ]?\d{3}\.\d{3}(?=\D|$)/;
const longIdNumber=/(?:^|\D)(?:\d[ .-]?){14,15}\d(?=\D|$)/;
export function containsPersonalIdentifier(text:string):boolean{
 return email.test(text)||mobile.test(text)||formattedTaxId.test(text)||longIdNumber.test(text);
}

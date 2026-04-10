const APPLY_FORM_URL = "https://forms.hackclub.com/t/f9JVqAtU5bus";

export async function GET() {
  return Response.redirect(APPLY_FORM_URL, 307);
}

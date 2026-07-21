import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * AI college advisor. Server-side only — the OpenAI key never reaches the
 * browser. Claude receives the student's stated priorities plus REAL data for
 * candidate colleges and must ground stats in that data; qualitative topics
 * (Greek life, sports culture, social scene) may draw on general knowledge but
 * must be labeled as reputation/impression, not fact.
 */
export async function POST(req: NextRequest) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return NextResponse.json(
      { fallback: true, error: "OPENAI_API_KEY is not configured." },
      { status: 503 },
    );
  }

  let body: { priorities?: string[]; vibe?: string; notes?: string; profile?: unknown; colleges?: unknown[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const colleges = Array.isArray(body.colleges) ? body.colleges.slice(0, 25) : [];
  if (colleges.length === 0) {
    return NextResponse.json({ error: "No candidate colleges provided." }, { status: 400 });
  }

  const system = `You are a college advisor inside the College Compass app. Rank the candidate colleges for this student.

Rules you must follow:
- Ground every number (cost, acceptance rate, graduation rate, demographics, aid) ONLY in the provided college data. If a data point is null/missing, say "not reported" — never invent numbers.
- Qualitative topics (Greek life/fraternities, party scene, sports culture, campus vibe) are not in the data. You may draw on general knowledge of well-known colleges, but label these as "reputation" and note they can be outdated or wrong; for colleges you don't recognize, say you don't have reliable information.
- NEVER state or imply a probability of admission, and never promise admission or financial aid.
- Colleges flagged isSample:true are fictional sample records — say so if you rank them.
- Respond with ONLY valid JSON, no markdown fences, in exactly this shape:
{"recommendations":[{"collegeId":"...","rank":1,"headline":"one sentence on why it fits","reasons":["..."],"watchouts":["..."]}],"generalAdvice":"2-3 sentences"}
- Rank at most 6 colleges. reasons: 2-4 items tied to the student's stated priorities. watchouts: 1-2 honest caveats each.`;

  const userMsg = `STUDENT PRIORITIES (most important to them): ${JSON.stringify(body.priorities ?? [])}
SOCIAL-SCENE PREFERENCE: ${body.vibe ?? "no preference"}
STUDENT'S OWN WORDS: ${JSON.stringify(body.notes ?? "")}
STUDENT PROFILE: ${JSON.stringify(body.profile ?? {})}
CANDIDATE COLLEGES (real data; nulls mean not reported): ${JSON.stringify(colleges)}`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        max_tokens: 3000,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: userMsg },
        ],
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json(
        { error: data?.error?.message ?? `OpenAI API error (${res.status})` },
        { status: 502 },
      );
    }
    const text: string = data?.choices?.[0]?.message?.content ?? "";
    const clean = text.replace(/```json|```/g, "").trim();
    try {
      return NextResponse.json(JSON.parse(clean));
    } catch {
      return NextResponse.json({ error: "The advisor returned an unreadable response — try again." }, { status: 502 });
    }
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { SCORECARD_FIELDS, scorecardToCollege } from "@/lib/scorecard";

const BASE = "https://api.data.gov/ed/collegescorecard/v1/schools";

/**
 * Server-side proxy for the College Scorecard API.
 * The API key lives only in COLLEGE_SCORECARD_API_KEY (never sent to the browser).
 */
export async function GET(req: NextRequest) {
  const key = process.env.COLLEGE_SCORECARD_API_KEY;
  if (!key) {
    return NextResponse.json(
      {
        fallback: true,
        error:
          "COLLEGE_SCORECARD_API_KEY is not configured. The app is running on labeled sample data.",
      },
      { status: 503 },
    );
  }

  const p = req.nextUrl.searchParams;
  const params = new URLSearchParams({ api_key: key, fields: SCORECARD_FIELDS });

  const name = p.get("name");
  if (name) params.set("school.name", name);
  const state = p.get("state");
  if (state) params.set("school.state", state);
  const ownership = p.get("ownership"); // 1 public, 2 nonprofit, 3 forprofit
  if (ownership) params.set("school.ownership", ownership);
  const level = p.get("level"); // 1 four-year, 2 two-year
  if (level) params.set("school.institutional_characteristics.level", level);
  // Only degree-granting, currently-operating institutions.
  params.set("school.operating", "1");
  params.set("latest.student.size__range", "100..");

  const page = Math.max(0, parseInt(p.get("page") ?? "0", 10) || 0);
  const perPage = Math.min(100, Math.max(1, parseInt(p.get("per_page") ?? "20", 10) || 20));
  params.set("page", String(page));
  params.set("per_page", String(perPage));
  params.set("sort", p.get("sort") ?? "latest.student.size:desc");

  try {
    const res = await fetch(`${BASE}?${params.toString()}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) {
      const body = await res.text();
      return NextResponse.json(
        { error: `Scorecard API error (${res.status}): ${body.slice(0, 300)}` },
        { status: 502 },
      );
    }
    const json = await res.json();
    const dataYear: string = json?.metadata?.year ? String(json.metadata.year) : "latest";
    const colleges = Array.isArray(json?.results)
      ? json.results.map((r: Record<string, unknown>) => scorecardToCollege(r, dataYear))
      : [];
    return NextResponse.json({
      colleges,
      total: json?.metadata?.total ?? colleges.length,
      page,
      perPage,
      dataYear,
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Could not reach the College Scorecard API: ${(err as Error).message}` },
      { status: 502 },
    );
  }
}

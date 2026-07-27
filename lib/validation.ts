import { NextRequest, NextResponse } from "next/server";
import { z, type ZodSchema } from "zod";

export const ApplicationStageSchema = z.enum([
  "Saved",
  "Applied",
  "Screening",
  "Interview",
  "Offer",
  "Rejected",
  "Ghosted",
  "Withdrawn",
  "Archived",
]);

/** ISO-ish date string that must parse to a valid Date. */
export const dateStringSchema = z.string().refine((s) => !isNaN(new Date(s).getTime()), {
  message: "Invalid date",
});

export const LabelSchema = z.string().trim().min(1).max(100);

/**
 * Parses and validates a request's JSON body against a Zod schema.
 * Returns `{ data }` on success or `{ error }` (a ready-to-return 400 response) on failure.
 */
export async function parseBody<T>(
  req: NextRequest,
  schema: ZodSchema<T>
): Promise<{ data: T; error?: undefined } | { data?: undefined; error: NextResponse }> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return { error: NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }) };
  }

  const result = schema.safeParse(json);
  if (!result.success) {
    return {
      error: NextResponse.json(
        { error: "Validation failed", details: result.error.flatten() },
        { status: 400 }
      ),
    };
  }

  return { data: result.data };
}

import { readOnchainDirectory } from '@/lib/cafe/onchain-registry';
import { errorMessage } from '@/lib/stellar/errors';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() {
  try { return Response.json(await readOnchainDirectory(), { headers: { 'Cache-Control': 'no-store' } }); }
  catch (error) { return Response.json({ error: errorMessage(error) }, { status: 503, headers: { 'Cache-Control': 'no-store' } }); }
}

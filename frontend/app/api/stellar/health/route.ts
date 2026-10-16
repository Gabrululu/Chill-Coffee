import { checkTestnetServices } from '@/lib/stellar/service-status';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() {
  return Response.json(await checkTestnetServices(), { headers: { 'Cache-Control': 'no-store' } });
}

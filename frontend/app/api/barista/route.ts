import { createBaristaHandlers } from '@/lib/ai/http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const handlers = createBaristaHandlers();
export const GET = handlers.GET;
export const POST = handlers.POST;

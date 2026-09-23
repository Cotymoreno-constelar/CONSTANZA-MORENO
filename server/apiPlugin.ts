import type { Plugin, ViteDevServer } from 'vite';
import fs from 'fs';
import path from 'path';
import type { IncomingMessage, ServerResponse } from 'http';
import { INITIAL_GUESTS } from '../src/data/initialGuests';
import type { Guest } from '../src/types/guest';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DATA_FILE = path.resolve(DATA_DIR, 'guests.json');

function ensureDataFile(): Guest[] {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, JSON.stringify(INITIAL_GUESTS, null, 2), 'utf-8');
      return INITIAL_GUESTS;
    }
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error loading guests.json, falling back to initial data', err);
    return INITIAL_GUESTS;
  }
}

function saveDataFile(guests: Guest[]): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(guests, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving guests.json', err);
  }
}

export function divoApiPlugin(): Plugin {
  const sseClients: Set<ServerResponse> = new Set();
  let guests = ensureDataFile();

  const broadcast = (data: { type: string; guest?: Guest; guests?: Guest[] }) => {
    const payload = `data: ${JSON.stringify(data)}\n\n`;
    for (const res of sseClients) {
      try {
        res.write(payload);
      } catch {
        sseClients.delete(res);
      }
    }
  };

  return {
    name: 'divo-api-server',
    configureServer(server: ViteDevServer) {
      server.middlewares.use((req: IncomingMessage, res: ServerResponse, next: () => void) => {
        const url = req.url || '';

        // Server-Sent Events Endpoint
        if (url === '/api/events') {
          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
          });
          res.write(`data: ${JSON.stringify({ type: 'CONNECTED', count: guests.length })}\n\n`);
          sseClients.add(res);

          req.on('close', () => {
            sseClients.delete(res);
          });
          return;
        }

        // Only intercept /api/ routes
        if (!url.startsWith('/api/')) {
          return next();
        }

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
          res.writeHead(204);
          res.end();
          return;
        }

        // Parse JSON Body
        const parseBody = (cb: (body: any) => void) => {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', () => {
            try {
              const parsed = body ? JSON.parse(body) : {};
              cb(parsed);
            } catch (err) {
              res.writeHead(400);
              res.end(JSON.stringify({ error: 'JSON malformado' }));
            }
          });
        };

        // GET /api/guests
        if (url === '/api/guests' && req.method === 'GET') {
          res.writeHead(200);
          res.end(JSON.stringify(guests));
          return;
        }

        // POST /api/guests (Add single guest)
        if (url === '/api/guests' && req.method === 'POST') {
          parseBody((body) => {
            const newGuest: Guest = body;
            guests = [newGuest, ...guests.filter((g) => g.id !== newGuest.id)];
            saveDataFile(guests);
            broadcast({ type: 'GUEST_ADDED', guest: newGuest, guests });
            res.writeHead(201);
            res.end(JSON.stringify(newGuest));
          });
          return;
        }

        // POST /api/guests/reset
        if (url === '/api/guests/reset' && req.method === 'POST') {
          guests = [...INITIAL_GUESTS];
          saveDataFile(guests);
          broadcast({ type: 'SYNC_ALL', guests });
          res.writeHead(200);
          res.end(JSON.stringify({ success: true, count: guests.length }));
          return;
        }

        // Match /api/guests/:id
        const guestIdMatch = url.match(/^\/api\/guests\/([^/?]+)(?:\/([^/?]+))?$/);
        if (guestIdMatch) {
          const guestId = guestIdMatch[1];
          const subAction = guestIdMatch[2]; // e.g. 'rsvp', 'checkin', 'undo-checkin'

          const guestIndex = guests.findIndex(
            (g) => g.id.toLowerCase() === guestId.toLowerCase() || g.token.toLowerCase() === guestId.toLowerCase()
          );

          if (guestIndex === -1) {
            res.writeHead(404);
            res.end(JSON.stringify({ error: 'Invitado no encontrado' }));
            return;
          }

          const targetGuest = guests[guestIndex];

          // PUT /api/guests/:id
          if (!subAction && req.method === 'PUT') {
            parseBody((body) => {
              guests[guestIndex] = {
                ...targetGuest,
                ...body,
                updatedAt: new Date().toISOString(),
              };
              saveDataFile(guests);
              broadcast({ type: 'GUEST_UPDATED', guest: guests[guestIndex], guests });
              res.writeHead(200);
              res.end(JSON.stringify(guests[guestIndex]));
            });
            return;
          }

          // DELETE /api/guests/:id
          if (!subAction && req.method === 'DELETE') {
            guests.splice(guestIndex, 1);
            saveDataFile(guests);
            broadcast({ type: 'GUEST_DELETED', guests });
            res.writeHead(200);
            res.end(JSON.stringify({ success: true }));
            return;
          }

          // POST /api/guests/:id/rsvp
          if (subAction === 'rsvp' && req.method === 'POST') {
            parseBody((body) => {
              const updated: Guest = {
                ...targetGuest,
                status: body.status,
                confirmedCompanions: body.status === 'confirmed' ? (body.confirmedCompanions || 0) : 0,
                companionName: body.status === 'confirmed' ? body.companionName : undefined,
                dietaryRestrictions: body.dietaryRestrictions,
                congratulationMessage: body.congratulationMessage,
                respondedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              };
              guests[guestIndex] = updated;
              saveDataFile(guests);
              broadcast({ type: 'GUEST_UPDATED', guest: updated, guests });
              res.writeHead(200);
              res.end(JSON.stringify(updated));
            });
            return;
          }

          // POST /api/guests/:id/checkin
          if (subAction === 'checkin' && req.method === 'POST') {
            parseBody((body) => {
              if (targetGuest.checkedIn && !body.forceAdmit) {
                res.writeHead(409);
                res.end(
                  JSON.stringify({
                    error: 'ALREADY_CHECKED_IN',
                    message: 'Este invitado ya ingresó anteriormente',
                    checkedInAt: targetGuest.checkedInAt,
                    guest: targetGuest,
                  })
                );
                return;
              }

              const updated: Guest = {
                ...targetGuest,
                checkedIn: true,
                checkedInAt: new Date().toISOString(),
                checkedInBy: body.checkedInBy || 'Puerta Principal',
                updatedAt: new Date().toISOString(),
              };
              guests[guestIndex] = updated;
              saveDataFile(guests);
              broadcast({ type: 'GUEST_CHECKED_IN', guest: updated, guests });
              res.writeHead(200);
              res.end(JSON.stringify({ success: true, guest: updated }));
            });
            return;
          }

          // POST /api/guests/:id/undo-checkin
          if (subAction === 'undo-checkin' && req.method === 'POST') {
            const updated: Guest = {
              ...targetGuest,
              checkedIn: false,
              checkedInAt: undefined,
              checkedInBy: undefined,
              updatedAt: new Date().toISOString(),
            };
            guests[guestIndex] = updated;
            saveDataFile(guests);
            broadcast({ type: 'GUEST_UPDATED', guest: updated, guests });
            res.writeHead(200);
            res.end(JSON.stringify(updated));
            return;
          }
        }

        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Ruta API no encontrada' }));
      });
    },
  };
}

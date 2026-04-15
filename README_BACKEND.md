# Causa Backend Setup

## Database Setup

1. Install PostgreSQL if not already installed
2. Create a database:
```bash
createdb causa
```

3. Update `.env.local` with your database credentials:
```
DATABASE_URL=postgresql://user:password@localhost:5432/causa
```

4. Generate and push the schema:
```bash
npm run db:push
```

## Available Scripts

- `npm run db:generate` - Generate migration files from schema
- `npm run db:migrate` - Run migrations
- `npm run db:push` - Push schema directly to database (dev)
- `npm run db:studio` - Open Drizzle Studio to browse data

## API Endpoints

### Alerts
- `GET /api/alerts` - List alerts (filters: status, severity, category)
- `GET /api/alerts/[id]` - Get single alert
- `PATCH /api/alerts/[id]` - Update alert

### Strategies
- `GET /api/strategies` - List strategies (filters: status, category, search)
- `GET /api/strategies/[id]` - Get single strategy
- `POST /api/strategies` - Create strategy
- `PATCH /api/strategies/[id]` - Update strategy
- `DELETE /api/strategies/[id]` - Soft delete strategy

### Recommendations
- `GET /api/recommendations` - List recommendations (filters: status, action)
- `GET /api/recommendations/[id]` - Get single recommendation
- `PATCH /api/recommendations/[id]` - Update recommendation

### Positions
- `GET /api/positions` - List positions (filters: status)
- `GET /api/positions/[id]` - Get single position
- `PATCH /api/positions/[id]` - Update position

### Execution Feedback
- `GET /api/execution-feedback` - List execution feedback
- `GET /api/execution-feedback/[id]` - Get single feedback
- `POST /api/execution-feedback` - Create execution feedback

## Client Usage

Import the API client:
```typescript
import { getAlerts, updateAlert } from '@/lib/api-client';

// Fetch alerts
const alerts = await getAlerts({ status: 'active' });

// Update alert
const updated = await updateAlert('alert-id', { status: 'acknowledged' });
```

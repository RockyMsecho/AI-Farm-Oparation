# AI FARM Operations Connection

The Crop Lifecycle, Livestock, Inventory and Tasks tabs are now connected to the SQL Server backend.

The browser sends JSON to `https://localhost:5226/api/Operations/...` with the JWT in the Authorization header. The API identifies the current user, gets the user's `FarmId`, validates the request and saves the record through Entity Framework Core.

## Connected modules

- **Crop Lifecycle:** varieties, planting, growth stage, treatment/activity log, health observations and harvests.
- **Livestock:** batches, health records, breeding, vaccinations, feed/mortality logs and production.
- **Inventory:** stock, stock usage, suppliers, purchase requests/orders and operating costs.
- **Tasks:** create/assign tasks, status changes, completion history and deletion.

All records are scoped to the logged-in user's farm and protected by the permission system.

## Database setup

The new models require a fresh EF Core migration for the development database. Run:

```powershell
.\RESET-DEV-DATABASE-AND-RUN.ps1
```

The script drops the development database, creates a fresh `InitialCreate` migration and applies it. **Do not use it against production data.**

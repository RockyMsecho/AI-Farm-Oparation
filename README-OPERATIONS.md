# AI FARM - Operations backend

The dashboard modules below are now connected to SQL Server through `OperationsController`:

- Crop Lifecycle: varieties, planting, growth stage, treatment/activity log, health observations and harvests.
- Livestock: batches, health records, breeding, vaccinations, feed/mortality logs and production.
- Inventory: stock, stock usage, suppliers, purchase requests/orders and operating costs.
- Tasks: create/assign tasks, status changes, completion history and deletion.

All records are scoped to the logged-in user's `FarmId` and protected by the permission system.

## Database

These new models require a new EF Core migration. For the development database, run:

```powershell
.\RESET-DEV-DATABASE-AND-RUN.ps1
```

The script creates a fresh `InitialCreate` migration and updates `FarmManagementDB`.

Do not use the reset script against a production database because it deletes the development database and its data.

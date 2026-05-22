The user wants to simplify the product checklist process when stock counting is not required. I will modify the backend to ensure all checklist flags are correctly returned and update the promoter app to allow quick completion of items.

### Backend Changes
- Update `GET /promotor/routes/:id` to:
    - Load `route_brands` for multi-brand routes.
    - Include all checklist requirement flags (`require_stock_count`, `require_validity_check`, etc.) from the checklist associated with each brand in `route_brands`.
    - Ensure the single-brand checklist flags are also correctly returned.

### Frontend Changes
- Update `PromotorRota.tsx` to:
    - Add a "Quick Check" button (green checkmark) directly on the product list items if `require_stock_count` and `require_validity_check` are both false. This allows completing an item with one tap.
    - Modify the `Product Detail Modal` to hide the "Contagem" (Counting) section and "Ocorrência" (Occurrence) buttons if they are not required by the active checklist.
    - Ensure the "Quick Check" button correctly updates the execution status to 'completed'.

### Implementation Details
- The logic will determine the current requirement flags based on whether the route is multi-brand (taking flags from the active brand's checklist) or single-brand (taking flags from the route's checklist).
- The "Quick Check" button will call the existing `updateExec` mutation with `status: 'completed', checked: true`.

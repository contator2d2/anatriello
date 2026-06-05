I will implement a new QR Code scanning access method for the supermarket portal. This allows promoters/agencies to scan a store-specific QR code using their own app to request or validate entry, which will then be approved by the supermarket network.

### User Interface Changes

- **Supermarket Landing Page**: Add information about the new "QR Code Terminal-less Access" method.
- **Totem Access Page**: 
    - Update to display a prominent QR Code that identifies the specific PDV when in "QR-only" or "Mixed" mode.
    - Implement a "QR Scanning" interface for promoters who want to scan the store's code.
- **Supermarket Settings**: 
    - Add a toggle for "QR Code Access (App-based)" alongside the existing CPF/Totem settings.
    - Add a section to download/print the store's unique access QR Code.
- **Promotor Home**:
    - Add a prominent "Scan Store QR Code" button.
    - Implement a QR scanner component that reads the store's code and sends an access request.
    - Display the real-time status of the access request (pending, approved, denied).

### Technical Details

- **Database**: Add a column `qr_access_enabled` to the `supermarket_units` or `totem_configs` table.
- **API Endpoints**:
    - `POST /api/access-control/qr-scan`: Processes a scan from the promotor app, identifying the PDV and the promotor, and creating a pending visit request if one doesn't exist for the day.
    - `GET /api/access-control/visit-status`: Allows the promotor app to poll or subscribe to the status of their entry request.
- **Promotor App**: Integrate a QR scanner library (like `html5-qrcode` or similar already used in the project if any).

### Next Steps

1.  Add the `qr_access_enabled` field to the supermarket configuration.
2.  Update the `SupermarketSettings` page to allow toggling this feature and viewing the QR Code.
3.  Implement the QR Scanner in `PromotorHome` or a new dedicated page.
4.  Update the backend logic to handle QR-based visit requests.

/**
 * Customer NusaSelecta top up recurring tidak ada komisi bagi sales, hanya topup pertama kali,
 * kecuali customer sudah lama vakum di free lalu ada top up lagi berkat sales lainnya,
 *     maka sales lain itu saja yang dapat komisi baru
 */

let where_include_customer_id =
  PropertiesService.getScriptProperties().getProperty("INCLUDE_CUSTOMER_ID") ||
  "";
where_include_customer_id = where_include_customer_id
  .split(",")
  .map((x) => (x.trim() ? `'${x.trim()}'` : ""))
  .join(",");
where_include_customer_id = where_include_customer_id
  ? `cit.CustId IN (${where_include_customer_id})`
  : "FALSE";

SQL_INVOICE_RECEIPT = `
SELECT
    cit.CustId \`CID\`,
    cit.CustServId 'CSID',
    cit.ServiceGroup \`SG\`,
    IFNULL(citc.InvoiceDate, cit.InvoiceDate) \`Tanggal Invoice\`,
    IFNULL(citc.InvoiceExpDate, cit.InvoiceExpDate) \`Tanggal Jatuh Tempo\`,
    cit.AwalPeriode \`Period Start\`,
    cit.AkhirPeriode \`Period End\`,
    itm.Month \`Bulan\`,
    IFNULL(ncic.dpp, cit.CustTotSubsFee - IFNULL(cid.Amount, 0)) - IFNULL(ncic.new_subscription, 0) \`DPP\`,
    IF(ncib.batchNo IS NULL, 0, 1) \`Paid\`,
    MAX(DATE(nci2.InsertDate)) \`Tanggal Input Pembayaran\`,
    MAX(IFNULL(ncic.trx_date, nci2.TransDate)) \`Tanggal Transaksi Pembayaran\`,
    nci.AI \`AI Invoice\`,
    MAX(nci2.AI) \`AI Receipt\`,
    cit.PeriodDescription \`Invoice Period Description\`,
    s.ServiceType AS \`Nama Service\`,
    (ncic.line_rental / IFNULL(itm.Month, 1)) \`Line Rental\`,
    IFNULL(ncic.is_prorata, 0) \`Is Prorata\`,
    cit.ServiceId \`SID\`
FROM
    CustomerInvoiceTemp cit
    LEFT JOIN CustomerInvoiceTemp_Custom citc ON cit.InvoiceNum = citc.InvoiceNum AND cit.Urut = citc.Urut
    LEFT JOIN InvoiceTypeMonth itm ON itm.InvoiceType = cit.InvoiceType
    LEFT JOIN NewCustomerInvoice nci ON cit.InvoiceNum = nci.Id AND nci.No = cit.Urut AND nci.Type = 'internet'
    LEFT JOIN NewCustomerInvoiceInternetCounter ncic ON ncic.AI = nci.AI
    LEFT JOIN CustomerInvoiceDiscount cid ON cid.InvoiceNum = cit.InvoiceNum AND cid.Urut = cit.Urut
    LEFT JOIN NewCustomerInvoiceBatch ncib ON nci.AI = ncib.AI
    LEFT JOIN NewCustomerInvoiceBatch ncib2 ON ncib.batchNo = ncib2.batchNo and ncib2.AI != ncib.AI and ncib2.total > 0
    LEFT JOIN NewCustomerInvoice nci2 ON ncib2.AI = nci2.AI
    LEFT JOIN CustomerServices cs ON cit.CustServId = cs.CustServId
    LEFT JOIN Customer c ON c.CustId = cs.CustId
    LEFT JOIN bca_customer_exception bce ON bce.customerId = c.CustId
    LEFT JOIN Services s ON s.ServiceId = cit.ServiceId
    LEFT JOIN ServiceGroup sg ON sg.ServiceGroup = s.ServiceGroup
WHERE cit.RInvoiceNum = 0
    AND (ncib.batchNo IS NULL OR nci2.Type = 'RA02')
    AND IFNULL(c.DisplayBranchId, c.BranchId) IN ('020', '062', '025', '027', '029')
    AND (cit.PeriodDescription NOT LIKE '%Upgrade%' OR ncic.dpp > ncic.new_subscription)
    AND (ncic.counter > 1 OR (ncic.counter = 1 AND ncic.dpp > ncic.new_subscription))
    AND (
      cit.AwalPeriode >= '$(period)' OR
      (nci2.TransDate IS NOT NULL AND nci2.TransDate BETWEEN '$(start_date)' AND '$(end_date)') OR
      (DATE(nci2.InsertDate) IS NOT NULL AND DATE(nci2.InsertDate) BETWEEN '$(start_date)' AND '$(end_date)') OR
      (ncic.trx_date IS NOT NULL AND ncic.trx_date BETWEEN '$(start_date)' AND '$(end_date)')
    )
    AND (cit.InvoiceType != 8 OR (cit.InvoiceType = 8 AND ${where_include_customer_id}))
    AND IFNULL(bce.type, 'customer') != 'internal'
    AND cs.CustStatus != 'FR'
GROUP BY nci.AI
HAVING DPP > 0
ORDER BY nci.AI;
`;

SQL_ACCOUNT = `
SELECT
    c.CustId AS \`CID\`,
    cs.CustServId AS \`CSID\`,
    c.CustName AS \`Nama Customer\`,
    c.CustCompany AS \`Company\`,
    cs.CustAccName AS \`Account\`,
    s.ServiceType AS \`Nama Service Account\`,
    s.ServiceGroup AS \`Category\`,
    IF(ss.NormalUpCeil > ss.NormalDownCeil, FLOOR(ss.NormalUpCeil/1024), FLOOR(ss.NormalDownCeil/1024)) AS \`Bandwidth (Mbps)\`,
    v.Vendor,
    vt.tagihan \`Line Rental Account\`,
    TRIM(CONCAT(TRIM(e1.EmpFName), ' ', TRIM(e1.EmpLName))) \`Sales\`,
    TRIM(CONCAT(TRIM(e2.EmpFName), ' ', TRIM(e2.EmpLName))) \`Manager Sales\`,
    b.BranchCity \`Cabang\`,
    cs.HandleByWHMCS AS \`WHMCS\`,
    IF(c.ResellerId > 1, r.Name, NULL) \`Reseller\`
FROM
    Customer c
    LEFT JOIN CustomerServices cs ON c.CustId = cs.CustId
    LEFT JOIN Services s ON cs.ServiceId = s.ServiceId
    LEFT JOIN ServiceGroup sg ON sg.ServiceGroup = s.ServiceGroup
    LEFT JOIN ServiceShaping ss ON ss.ServiceId = s.ServiceId
    LEFT JOIN (
        SELECT
            cstl.custServId \`CSID\`,
            group_concat(distinct fv.name) \`Vendor\`
        FROM
            CustomerServiceTechnicalLink cstl
            LEFT JOIN noc_fiber nf ON cstl.foVendorId = nf.id
            LEFT JOIN fiber_vendor fv ON fv.id = nf.vendorId
        WHERE cstl.type = 'fo'
        GROUP BY cstl.custServId
    ) v ON cs.CustServId = v.CSID
    LEFT JOIN (
        SELECT
            typeId csid,
            sum(tagihan) tagihan
        FROM FiberVendorServices
        WHERE
            type = 'CustomerServices' AND
            \`show\` = 1 AND
            typeId != 0
        GROUP BY typeId
    ) vt ON vt.csid = cs.CustServId
    LEFT JOIN Employee e1 ON e1.EmpId = IFNULL(cs.SalesId, c.SalesId)
    LEFT JOIN Employee e2 ON e2.EmpId = IFNULL(cs.ManagerSalesId, c.ManagerSalesId)
    LEFT JOIN NusaBranch b ON b.BranchId = IFNULL(c.DisplayBranchId, c.BranchId)
    LEFT JOIN bca_customer_exception bce ON bce.customerId = c.CustId
    LEFT JOIN Reseller r ON r.Id = c.ResellerId
WHERE
    IFNULL(c.DisplayBranchId, c.BranchId) IN ('020', '062', '025', '027', '029')
    AND IFNULL(bce.type, 'customer') != 'internal';
`;
SQL_RESIGN = `SELECT cust_id FROM transfer_customers WHERE initial_sales = '$(sales_id)'`;

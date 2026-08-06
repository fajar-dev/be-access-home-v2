CREATE TABLE snapshots(
    id INT AUTO_INCREMENT PRIMARY KEY,
    period VARCHAR(6) NOT NULL,
    ai_invoice BIGINT NOT NULL,
    ai_receipt BIGINT NULL,
    customer_id VARCHAR(20) NOT NULL,
    customer_name VARCHAR(255) NULL,
    customer_company VARCHAR(255) NULL,
    customer_service_id BIGINT NULL,
    customer_service_account VARCHAR(255) NULL,
    service_name VARCHAR(255) NULL,
    service_category VARCHAR(255) NULL,
    sales VARCHAR(255) NULL,
    manager VARCHAR(255) NULL,
    vendor VARCHAR(255) NULL,
    subscription DECIMAL(18,2) NULL,
    line_rental DECIMAL(18,2) NULL,
    paid_date DATE NULL,
    month INT NULL,
    late_month INT DEFAULT 0,
    type ENUM('new','prorate','upgrade','recurring') NULL DEFAULT NULL,
    referral_fee DECIMAL(15,2) DEFAULT 0,
    referral_type ENUM('OTC','Cashback', 'Monthly') NULL DEFAULT NULL,
    referral_name VARCHAR(255) NULL,
    is_approved BOOLEAN NOT NULL DEFAULT FALSE,
    INDEX idx_snapshots_period (period)
);

CREATE TABLE employee (
    id INT PRIMARY KEY,
    employee_id VARCHAR(20) NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    photo_profile VARCHAR(255) NOT NULL,
    job_position VARCHAR(255) NOT NULL,
    organization_name VARCHAR(255) NOT NULL,
    job_level VARCHAR(50) NOT NULL,
    branch VARCHAR(255) NOT NULL,
    status VARCHAR(255) NOT NULL,
    manager_id INT NULL,
    has_dashboard BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_admin BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE status_period (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id VARCHAR(20) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status ENUM('Probation', 'Permanent') NOT NULL DEFAULT 'Probation'
);
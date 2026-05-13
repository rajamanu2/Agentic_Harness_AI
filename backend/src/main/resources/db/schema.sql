CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL,
    actor VARCHAR(100) NOT NULL,
    source_system VARCHAR(100) NOT NULL,
    message TEXT NOT NULL,
    payload JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS org_scan_result (
    id UUID PRIMARY KEY,
    org_alias VARCHAR(100) NOT NULL,
    health_status VARCHAR(50) NOT NULL,
    risk_score INT NOT NULL,
    summary TEXT NOT NULL,
    findings_json JSONB,
    raw_result JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_task (
    id UUID PRIMARY KEY,
    task_type VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL,
    input TEXT,
    output TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS approval_request (
    id UUID PRIMARY KEY,
    request_type VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL,
    requested_by VARCHAR(100) NOT NULL,
    approved_by VARCHAR(100),
    summary TEXT NOT NULL,
    payload JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved_at TIMESTAMP
);

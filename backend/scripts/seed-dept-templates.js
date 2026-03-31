/**
 * Re-seed dept_task_templates. Clears table then inserts templates with
 * only task_title and required_job_titles (no description_hint).
 * Run from backend: node scripts/seed-dept-templates.js
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const templates = [
  // SALES
  { department: 'Sales', task_title: 'Follow Up with Lead', required_job_titles: ['Sales Executive', 'Business Development Executive', 'Sales Manager'] },
  { department: 'Sales', task_title: 'Prepare Sales Proposal', required_job_titles: ['Sales Executive', 'Sales Manager', 'Business Development Executive'] },
  { department: 'Sales', task_title: 'Conduct Product Demo', required_job_titles: ['Sales Executive', 'Business Development Executive'] },
  { department: 'Sales', task_title: 'Update CRM Records', required_job_titles: ['Sales Executive', 'Sales Coordinator'] },
  { department: 'Sales', task_title: 'Quarterly Sales Report', required_job_titles: ['Sales Manager', 'Sales Analyst'] },
  { department: 'Sales', task_title: 'Client Onboarding', required_job_titles: ['Sales Executive', 'Sales Coordinator', 'Sales Manager'] },
  { department: 'Sales', task_title: 'Market Research', required_job_titles: ['Sales Analyst', 'Business Development Executive'] },
  { department: 'Sales', task_title: 'Pipeline Review', required_job_titles: ['Sales Manager', 'Sales Executive'] },
  { department: 'Sales', task_title: 'Contract Negotiation', required_job_titles: ['Sales Manager', 'Business Development Executive'] },
  { department: 'Sales', task_title: 'Cold Outreach Campaign', required_job_titles: ['Sales Executive', 'Business Development Executive'] },

  // PRESALES
  { department: 'Presales', task_title: 'RFP/RFQ Response', required_job_titles: ['Presales Consultant', 'Solution Architect', 'Technical Consultant'] },
  { department: 'Presales', task_title: 'Technical Solution Design', required_job_titles: ['Solution Architect', 'Presales Consultant'] },
  { department: 'Presales', task_title: 'Proof of Concept (POC)', required_job_titles: ['Presales Consultant', 'Solution Architect', 'Technical Consultant'] },
  { department: 'Presales', task_title: 'Requirements Gathering', required_job_titles: ['Presales Consultant', 'Business Analyst', 'Solution Architect'] },
  { department: 'Presales', task_title: 'Competitive Analysis', required_job_titles: ['Presales Consultant', 'Technical Consultant'] },
  { department: 'Presales', task_title: 'Pricing & Estimation', required_job_titles: ['Presales Consultant', 'Solution Architect', 'Presales Manager'] },
  { department: 'Presales', task_title: 'Solution Presentation', required_job_titles: ['Presales Consultant', 'Solution Architect'] },
  { department: 'Presales', task_title: 'Statement of Work (SOW)', required_job_titles: ['Presales Manager', 'Solution Architect', 'Presales Consultant'] },
  { department: 'Presales', task_title: 'Demo Environment Setup', required_job_titles: ['Presales Consultant', 'Technical Consultant'] },
  { department: 'Presales', task_title: 'Win/Loss Analysis', required_job_titles: ['Presales Manager', 'Presales Consultant'] },

  // HR
  { department: 'HR', task_title: 'Onboard New Employee', required_job_titles: ['HR', 'HR Manager', 'HR Executive'] },
  { department: 'HR', task_title: 'Process Monthly Payroll', required_job_titles: ['HR', 'Payroll Specialist', 'HR Manager'] },
  { department: 'HR', task_title: 'Conduct Performance Review', required_job_titles: ['HR Manager', 'HR'] },
  { department: 'HR', task_title: 'Job Posting & Recruitment', required_job_titles: ['HR', 'HR Executive', 'HR Manager', 'Talent Acquisition'] },
  { department: 'HR', task_title: 'Update Employee Records', required_job_titles: ['HR', 'HR Executive'] },
  { department: 'HR', task_title: 'Leave Policy Review', required_job_titles: ['HR Manager'] },
  { department: 'HR', task_title: 'Employee Engagement Activity', required_job_titles: ['HR', 'HR Executive', 'HR Manager'] },
  { department: 'HR', task_title: 'Exit Interview & Offboarding', required_job_titles: ['HR', 'HR Manager'] },
  { department: 'HR', task_title: 'Compliance & Policy Audit', required_job_titles: ['HR Manager'] },
  { department: 'HR', task_title: 'Training Program Coordination', required_job_titles: ['HR', 'HR Executive', 'HR Manager'] },

  // SCM
  { department: 'SCM', task_title: 'Vendor Evaluation', required_job_titles: ['SCM Executive', 'Procurement Manager', 'Supply Chain Analyst'] },
  { department: 'SCM', task_title: 'Purchase Order Processing', required_job_titles: ['SCM Executive', 'Procurement Manager'] },
  { department: 'SCM', task_title: 'Inventory Audit', required_job_titles: ['SCM Executive', 'Warehouse Executive', 'Supply Chain Analyst'] },
  { department: 'SCM', task_title: 'Supplier Contract Renewal', required_job_titles: ['Procurement Manager', 'SCM Executive'] },
  { department: 'SCM', task_title: 'Logistics Coordination', required_job_titles: ['SCM Executive', 'Logistics Coordinator'] },
  { department: 'SCM', task_title: 'Demand Forecasting', required_job_titles: ['Supply Chain Analyst', 'Procurement Manager'] },
  { department: 'SCM', task_title: 'Quality Inspection', required_job_titles: ['SCM Executive', 'Quality Analyst'] },
  { department: 'SCM', task_title: 'Cost Reduction Analysis', required_job_titles: ['Supply Chain Analyst', 'Procurement Manager'] },
  { department: 'SCM', task_title: 'ERP Data Update', required_job_titles: ['SCM Executive', 'Supply Chain Analyst'] },

  // FINANCE
  { department: 'Finance', task_title: 'Process Vendor Invoice', required_job_titles: ['Accountant', 'Finance Manager', 'Finance Executive'] },
  { department: 'Finance', task_title: 'Monthly Bank Reconciliation', required_job_titles: ['Accountant', 'Finance Executive'] },
  { department: 'Finance', task_title: 'Budget Planning', required_job_titles: ['Finance Manager', 'Financial Analyst'] },
  { department: 'Finance', task_title: 'Expense Report Review', required_job_titles: ['Finance Manager', 'Accountant'] },
  { department: 'Finance', task_title: 'Tax Filing Preparation', required_job_titles: ['Accountant', 'Finance Manager', 'Tax Consultant'] },
  { department: 'Finance', task_title: 'Financial Reporting', required_job_titles: ['Finance Manager', 'Financial Analyst', 'Accountant'] },
  { department: 'Finance', task_title: 'Audit Support', required_job_titles: ['Accountant', 'Finance Manager'] },
  { department: 'Finance', task_title: 'Accounts Receivable Follow-up', required_job_titles: ['Accountant', 'Finance Executive'] },
  { department: 'Finance', task_title: 'Payroll Processing', required_job_titles: ['Accountant', 'Finance Manager', 'Payroll Specialist'] },
  { department: 'Finance', task_title: 'Cost Analysis Report', required_job_titles: ['Financial Analyst', 'Finance Manager'] },

  // CLOUD
  { department: 'Cloud', task_title: 'Cloud Infrastructure Setup', required_job_titles: ['Cloud Engineer', 'IT Trainee', 'DevOps Engineer'] },
  { department: 'Cloud', task_title: 'Server Monitoring & Alerts', required_job_titles: ['Cloud Engineer', 'IT Trainee', 'DevOps Engineer'] },
  { department: 'Cloud', task_title: 'Database Backup & Recovery', required_job_titles: ['Cloud Engineer', 'Database Administrator', 'IT Trainee'] },
  { department: 'Cloud', task_title: 'Cost Optimization Review', required_job_titles: ['Cloud Engineer', 'DevOps Engineer'] },
  { department: 'Cloud', task_title: 'Security Patching', required_job_titles: ['Cloud Engineer', 'IT Trainee', 'DevOps Engineer'] },
  { department: 'Cloud', task_title: 'CI/CD Pipeline Setup', required_job_titles: ['DevOps Engineer', 'Cloud Engineer', 'App Developer'] },
  { department: 'Cloud', task_title: 'Disaster Recovery Testing', required_job_titles: ['Cloud Engineer', 'DevOps Engineer'] },
  { department: 'Cloud', task_title: 'Access & IAM Review', required_job_titles: ['Cloud Engineer', 'DevOps Engineer'] },
  { department: 'Cloud', task_title: 'Infrastructure Documentation', required_job_titles: ['Cloud Engineer', 'IT Trainee'] },
  { department: 'Cloud', task_title: 'Performance Optimization', required_job_titles: ['Cloud Engineer', 'DevOps Engineer', 'IT Trainee'] },

  // DATA & AI
  { department: 'Data&Ai', task_title: 'Build ML Model', required_job_titles: ['GenAI Developer', 'Data Scientist', 'AI Engineer'] },
  { department: 'Data&Ai', task_title: 'Data Pipeline Development', required_job_titles: ['App Developer', 'GenAI Developer', 'Data Engineer', 'IT Trainee'] },
  { department: 'Data&Ai', task_title: 'Data Analysis & Insights', required_job_titles: ['Data Scientist', 'Data Analyst', 'GenAI Developer'] },
  { department: 'Data&Ai', task_title: 'Model Deployment', required_job_titles: ['GenAI Developer', 'AI Engineer', 'App Developer'] },
  { department: 'Data&Ai', task_title: 'Dashboard Development', required_job_titles: ['Data Analyst', 'App Developer', 'GenAI Developer'] },
  { department: 'Data&Ai', task_title: 'Data Quality Audit', required_job_titles: ['Data Engineer', 'Data Analyst', 'IT Trainee'] },
  { department: 'Data&Ai', task_title: 'LLM Integration', required_job_titles: ['GenAI Developer', 'AI Engineer', 'App Developer'] },
  { department: 'Data&Ai', task_title: 'Model Performance Review', required_job_titles: ['GenAI Developer', 'Data Scientist', 'AI Engineer'] },
  { department: 'Data&Ai', task_title: 'Research & Experimentation', required_job_titles: ['Data Scientist', 'GenAI Developer', 'AI Engineer'] },
  { department: 'Data&Ai', task_title: 'Code Review', required_job_titles: ['App Developer', 'GenAI Developer', 'IT Trainee'] },

  // CYBERSECURITY
  { department: 'Cybersecurity', task_title: 'Vulnerability Assessment', required_job_titles: ['Security Analyst', 'Cyber Security Engineer', 'Cyber Security Associate', 'Penetration Tester'] },
  { department: 'Cybersecurity', task_title: 'Penetration Testing', required_job_titles: ['Penetration Tester', 'Cyber Security Engineer', 'Cyber Security Associate', 'Security Analyst'] },
  { department: 'Cybersecurity', task_title: 'Security Incident Response', required_job_titles: ['Security Analyst', 'Cyber Security Engineer', 'Cyber Security Associate', 'SOC Analyst'] },
  { department: 'Cybersecurity', task_title: 'Firewall Rule Review', required_job_titles: ['Security Analyst', 'Network Security Engineer', 'Cyber Security Engineer'] },
  { department: 'Cybersecurity', task_title: 'Security Awareness Training', required_job_titles: ['Security Analyst', 'Cyber Security Engineer', 'Cyber Security Associate'] },
  { department: 'Cybersecurity', task_title: 'Access Control Audit', required_job_titles: ['Security Analyst', 'Cyber Security Engineer', 'Cyber Security Associate', 'SOC Analyst'] },
  { department: 'Cybersecurity', task_title: 'SIEM Log Analysis', required_job_titles: ['SOC Analyst', 'Security Analyst', 'Cyber Security Associate'] },
  { department: 'Cybersecurity', task_title: 'Compliance Audit', required_job_titles: ['Cyber Security Engineer', 'Security Analyst', 'Compliance Officer', 'GRC Analyst'] },
  { department: 'Cybersecurity', task_title: 'Security Policy Update', required_job_titles: ['Cyber Security Engineer', 'Security Manager', 'GRC Analyst'] },
  { department: 'Cybersecurity', task_title: 'Endpoint Security Review', required_job_titles: ['Security Analyst', 'SOC Analyst', 'Cyber Security Engineer', 'Cyber Security Associate'] },
  { department: 'Cybersecurity', task_title: 'Threat Hunting Review', required_job_titles: ['SOC Analyst', 'Cyber Security Engineer', 'Cyber Security Associate'] },
  { department: 'Cybersecurity', task_title: 'Phishing Simulation Follow-up', required_job_titles: ['Cyber Security Associate', 'Security Analyst', 'Security Manager'] },

  // NETWORKING
  { department: 'Networking', task_title: 'Network Configuration', required_job_titles: ['Network Engineer', 'Network Administrator', 'IT Trainee'] },
  { department: 'Networking', task_title: 'Network Monitoring Setup', required_job_titles: ['Network Engineer', 'Network Administrator'] },
  { department: 'Networking', task_title: 'VPN Setup & Management', required_job_titles: ['Network Engineer', 'Network Administrator', 'IT Trainee'] },
  { department: 'Networking', task_title: 'Network Troubleshooting', required_job_titles: ['Network Engineer', 'Network Administrator', 'IT Trainee'] },
  { department: 'Networking', task_title: 'Bandwidth Analysis', required_job_titles: ['Network Engineer', 'Network Administrator'] },
  { department: 'Networking', task_title: 'Network Documentation Update', required_job_titles: ['Network Engineer', 'IT Trainee'] },
  { department: 'Networking', task_title: 'Firmware & Software Update', required_job_titles: ['Network Engineer', 'Network Administrator'] },
  { department: 'Networking', task_title: 'DNS & DHCP Management', required_job_titles: ['Network Administrator', 'Network Engineer', 'IT Trainee'] },
  { department: 'Networking', task_title: 'Network Capacity Planning', required_job_titles: ['Network Engineer', 'Network Administrator'] },

  // IT HELP DESK
  { department: 'IT Help Desk', task_title: 'Hardware Issue Resolution', required_job_titles: ['IT Support Engineer', 'Help Desk Technician', 'IT Trainee'] },
  { department: 'IT Help Desk', task_title: 'Software Installation', required_job_titles: ['IT Support Engineer', 'Help Desk Technician', 'IT Trainee'] },
  { department: 'IT Help Desk', task_title: 'User Account Management', required_job_titles: ['IT Support Engineer', 'System Administrator', 'IT Trainee'] },
  { department: 'IT Help Desk', task_title: 'Email & Communication Setup', required_job_titles: ['IT Support Engineer', 'Help Desk Technician', 'IT Trainee'] },
  { department: 'IT Help Desk', task_title: 'Printer & Peripheral Support', required_job_titles: ['Help Desk Technician', 'IT Support Engineer', 'IT Trainee'] },
  { department: 'IT Help Desk', task_title: 'Ticket Escalation Review', required_job_titles: ['IT Support Engineer', 'Help Desk Manager'] },
  { department: 'IT Help Desk', task_title: 'New Joiner IT Setup', required_job_titles: ['IT Support Engineer', 'Help Desk Technician', 'IT Trainee'] },
  { department: 'IT Help Desk', task_title: 'System Performance Check', required_job_titles: ['IT Support Engineer', 'IT Trainee'] },
  { department: 'IT Help Desk', task_title: 'Knowledge Base Update', required_job_titles: ['IT Support Engineer', 'Help Desk Technician'] },
  { department: 'IT Help Desk', task_title: 'Asset Inventory Update', required_job_titles: ['IT Support Engineer', 'IT Trainee', 'Help Desk Technician'] },

  // DEPLOYMENT
  { department: 'Deployment', task_title: 'Production Deployment', required_job_titles: ['DevOps Engineer', 'Deployment Engineer', 'App Developer'] },
  { department: 'Deployment', task_title: 'UAT Environment Setup', required_job_titles: ['DevOps Engineer', 'Deployment Engineer', 'IT Trainee'] },
  { department: 'Deployment', task_title: 'Rollback Execution', required_job_titles: ['DevOps Engineer', 'Deployment Engineer'] },
  { department: 'Deployment', task_title: 'Release Note Preparation', required_job_titles: ['Deployment Engineer', 'App Developer', 'IT Trainee'] },
  { department: 'Deployment', task_title: 'Smoke Testing Post Deploy', required_job_titles: ['DevOps Engineer', 'QA Engineer', 'Deployment Engineer'] },
  { department: 'Deployment', task_title: 'Config & Secrets Management', required_job_titles: ['DevOps Engineer', 'Deployment Engineer'] },
  { department: 'Deployment', task_title: 'Deployment Pipeline Update', required_job_titles: ['DevOps Engineer', 'App Developer'] },
  { department: 'Deployment', task_title: 'Database Migration', required_job_titles: ['DevOps Engineer', 'Database Administrator', 'App Developer'] },
  { department: 'Deployment', task_title: 'Deployment Checklist Review', required_job_titles: ['Deployment Engineer', 'DevOps Engineer'] },
  { department: 'Deployment', task_title: 'Post-Deploy Monitoring', required_job_titles: ['DevOps Engineer', 'Deployment Engineer', 'IT Trainee'] },

  // ORGANIZATION
  { department: 'Organization', task_title: 'Strategic Planning Session', required_job_titles: ['Operations Manager', 'Business Analyst', 'Strategy Consultant'] },
  { department: 'Organization', task_title: 'OKR Review & Update', required_job_titles: ['Operations Manager', 'Business Analyst'] },
  { department: 'Organization', task_title: 'Policy Documentation', required_job_titles: ['Operations Manager', 'Business Analyst', 'Compliance Officer'] },
  { department: 'Organization', task_title: 'Cross-Department Coordination', required_job_titles: ['Operations Manager', 'Project Manager', 'Business Analyst'] },
  { department: 'Organization', task_title: 'Vendor Management Review', required_job_titles: ['Operations Manager', 'Procurement Manager'] },
  { department: 'Organization', task_title: 'Board Meeting Preparation', required_job_titles: ['Operations Manager', 'Business Analyst', 'Executive Assistant'] },
  { department: 'Organization', task_title: 'Process Improvement Initiative', required_job_titles: ['Business Analyst', 'Operations Manager', 'Process Consultant'] },
  { department: 'Organization', task_title: 'Annual Report Compilation', required_job_titles: ['Operations Manager', 'Business Analyst'] },
  { department: 'Organization', task_title: 'Risk Assessment', required_job_titles: ['Risk Analyst', 'Operations Manager', 'Compliance Officer'] },
  { department: 'Organization', task_title: 'Internal Audit Coordination', required_job_titles: ['Operations Manager', 'Compliance Officer', 'Business Analyst'] },
];

async function run() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl || typeof dbUrl !== 'string') {
    console.error('DATABASE_URL is not set. Run from backend: node scripts/seed-dept-templates.js');
    process.exit(1);
  }

  const { query } = await import('../src/config/database.js');
  const pool = (await import('../src/config/database.js')).default;

  try {
    console.log('[Seed] TRUNCATE dept_task_templates...');
    await query('TRUNCATE TABLE dept_task_templates RESTART IDENTITY CASCADE');

    console.log('[Seed] Inserting', templates.length, 'templates (description_hint = NULL)...');
    for (const t of templates) {
      await query(
        `INSERT INTO dept_task_templates (department, task_title, required_job_titles, description_hint, is_active)
         VALUES ($1, $2, $3, NULL, true)`,
        [t.department, t.task_title, t.required_job_titles]
      );
    }

    const { rows: counts } = await query(
      `SELECT department, COUNT(*) AS count FROM dept_task_templates GROUP BY department ORDER BY department`
    );
    console.log('[Seed] Per department:');
    let total = 0;
    for (const row of counts) {
      console.log('  ', row.department, row.count);
      total += parseInt(row.count, 10);
    }
    console.log('[Seed] Total:', total, 'templates.');
  } catch (err) {
    console.error('[Seed] Error:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();

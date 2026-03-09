/**
 * Oracle Fusion HCM — Groovy Compensation Rule
 * Script Name: COMPENSATION
 *
 * Calculates total compensation for an employee by calling existing
 * PL/SQL objects.  This script does NOT query the EMPLOYEES table
 * directly; it relies on CALC_ANNUAL_BONUS and HR_PACKAGE.GET_HEADCOUNT,
 * making it an INDIRECT dependent of EMPLOYEES.
 */

import oracle.apps.hcm.compensation.CalcEngine
import oracle.apps.hcm.payroll.PayrollService

// --- Configuration ---
def employeeId   = context.getEmployeeId()
def departmentId = context.getDepartmentId()

// Step 1: Calculate annual bonus via the PL/SQL function
// (CALC_ANNUAL_BONUS internally reads from EMPLOYEES and JOBS)
def annualBonus = sql.executeFunction("CALC_ANNUAL_BONUS", [employeeId])

// Step 2: Get department headcount from the HR package
// (HR_PACKAGE.GET_HEADCOUNT internally queries EMPLOYEES)
def headcount = sql.executeFunction("HR_PACKAGE.GET_HEADCOUNT", [departmentId])

// Step 3: Derive a per-capita department adjustment factor
def adjustmentFactor = (headcount != null && headcount > 0) ? (1.0 / headcount) : 0.01

// Step 4: Compute total compensation adjustment
def totalAdjustment = (annualBonus ?: 0) * adjustmentFactor

// Log result
logger.info("Compensation calculated for EMP ${employeeId}: bonus=${annualBonus}, headcount=${headcount}, adj=${totalAdjustment}")

return [
    employee_id     : employeeId,
    annual_bonus    : annualBonus,
    dept_headcount  : headcount,
    adjustment      : totalAdjustment
]

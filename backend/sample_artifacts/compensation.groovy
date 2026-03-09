/**
 * Oracle Fusion HCM — Groovy Fast Formula Script
 * Compensation Calculation Rule
 *
 * References: HR_PACKAGE, CALC_ANNUAL_BONUS function, EMPLOYEES table
 */

import oracle.apps.hcm.compensation.CalcEngine
import oracle.apps.hcm.payroll.PayrollService

// Fetch employee base salary from EMPLOYEES table
def employeeId = context.getEmployeeId()
def baseSalary = sql.executeQuery(
    "SELECT SALARY FROM EMPLOYEES WHERE EMPLOYEE_ID = ?",
    [employeeId]
)

// Calculate annual bonus using the function
def annualBonus = sql.executeFunction("CALC_ANNUAL_BONUS", [employeeId])

// Use HR_PACKAGE for processing
def processed = sql.executeFunction("HR_PACKAGE.GET_HEADCOUNT", [context.getDepartmentId()])

// Compute total compensation
def totalCompensation = (baseSalary * 12) + annualBonus

// Log result
logger.info("Compensation calculated for EMP ${employeeId}: ${totalCompensation}")

return totalCompensation

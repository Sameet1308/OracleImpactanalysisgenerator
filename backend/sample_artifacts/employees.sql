-- ============================================================
-- Oracle HR / Payroll Schema — Sample Artifacts
-- Contains: 4 tables, 2 views, 1 procedure, 1 function,
--           1 package (spec+body), 1 trigger, 1 sequence
-- Designed for rich dependency-graph demo with direct + indirect impacts
-- ============================================================

-- ==================== TABLES ====================

CREATE TABLE DEPARTMENTS (
    DEPARTMENT_ID   NUMBER(4)    PRIMARY KEY,
    DEPARTMENT_NAME VARCHAR2(60) NOT NULL,
    MANAGER_ID      NUMBER(6),
    LOCATION_ID     NUMBER(4)
);

CREATE TABLE JOBS (
    JOB_ID     VARCHAR2(10) PRIMARY KEY,
    JOB_TITLE  VARCHAR2(50) NOT NULL,
    MIN_SALARY NUMBER(8,2),
    MAX_SALARY NUMBER(8,2)
);

CREATE TABLE EMPLOYEES (
    EMPLOYEE_ID    NUMBER(6)    PRIMARY KEY,
    FIRST_NAME     VARCHAR2(40),
    LAST_NAME      VARCHAR2(40) NOT NULL,
    EMAIL          VARCHAR2(80) NOT NULL UNIQUE,
    PHONE_NUMBER   VARCHAR2(20),
    HIRE_DATE      DATE         NOT NULL,
    JOB_ID         VARCHAR2(10) NOT NULL REFERENCES JOBS(JOB_ID),
    SALARY         NUMBER(8,2),
    COMMISSION_PCT NUMBER(2,2),
    MANAGER_ID     NUMBER(6)    REFERENCES EMPLOYEES(EMPLOYEE_ID),
    DEPARTMENT_ID  NUMBER(4)    REFERENCES DEPARTMENTS(DEPARTMENT_ID)
);

CREATE TABLE SALARY_AUDIT_LOG (
    AUDIT_ID        NUMBER(10)   PRIMARY KEY,
    EMPLOYEE_ID     NUMBER(6)    NOT NULL,
    OLD_SALARY      NUMBER(8,2),
    NEW_SALARY      NUMBER(8,2),
    CHANGED_BY      VARCHAR2(60),
    CHANGE_DATE     DATE         DEFAULT SYSDATE
);

-- ==================== SEQUENCE ====================

CREATE SEQUENCE EMP_ID_SEQ
    START WITH 1000
    INCREMENT BY 1
    NOCACHE
    NOCYCLE;

-- ==================== VIEWS ====================

CREATE OR REPLACE VIEW HR_EMPLOYEE_SUMMARY AS
SELECT
    e.EMPLOYEE_ID,
    e.FIRST_NAME || ' ' || e.LAST_NAME AS FULL_NAME,
    e.EMAIL,
    e.HIRE_DATE,
    e.SALARY,
    d.DEPARTMENT_NAME,
    d.DEPARTMENT_ID
FROM EMPLOYEES e
JOIN DEPARTMENTS d ON d.DEPARTMENT_ID = e.DEPARTMENT_ID;

CREATE OR REPLACE VIEW PAYROLL_VIEW AS
SELECT
    e.EMPLOYEE_ID,
    e.FIRST_NAME,
    e.LAST_NAME,
    e.SALARY,
    e.COMMISSION_PCT,
    j.JOB_TITLE,
    j.MIN_SALARY AS JOB_MIN,
    j.MAX_SALARY AS JOB_MAX,
    e.DEPARTMENT_ID
FROM EMPLOYEES e
JOIN JOBS j ON j.JOB_ID = e.JOB_ID;

-- ==================== PROCEDURE ====================

CREATE OR REPLACE PROCEDURE GET_EMPLOYEE_SALARY (
    p_employee_id IN  NUMBER,
    p_salary      OUT NUMBER
) AS
BEGIN
    SELECT SALARY
    INTO   p_salary
    FROM   EMPLOYEES
    WHERE  EMPLOYEE_ID = p_employee_id;
EXCEPTION
    WHEN NO_DATA_FOUND THEN
        p_salary := 0;
END GET_EMPLOYEE_SALARY;
/

-- ==================== FUNCTION ====================

CREATE OR REPLACE FUNCTION CALC_ANNUAL_BONUS (
    p_employee_id IN NUMBER
) RETURN NUMBER AS
    v_salary   NUMBER;
    v_job_max  NUMBER;
    v_bonus    NUMBER;
BEGIN
    -- Fetch current salary via existing procedure
    v_salary := GET_EMPLOYEE_SALARY(p_employee_id);

    -- Determine the salary ceiling for this employee's job
    SELECT j.MAX_SALARY
    INTO   v_job_max
    FROM   EMPLOYEES e
    JOIN   JOBS j ON j.JOB_ID = e.JOB_ID
    WHERE  e.EMPLOYEE_ID = p_employee_id;

    -- Bonus is 10% of salary, prorated by how far below the ceiling
    IF v_job_max > 0 THEN
        v_bonus := v_salary * 0.10 * (1 - (v_salary / v_job_max));
    ELSE
        v_bonus := v_salary * 0.05;
    END IF;

    RETURN ROUND(v_bonus, 2);
END CALC_ANNUAL_BONUS;
/

-- ==================== PACKAGE ====================

CREATE OR REPLACE PACKAGE HR_PACKAGE AS
    FUNCTION  GET_HEADCOUNT  (p_dept_id IN NUMBER) RETURN NUMBER;
    PROCEDURE SYNC_EMPLOYEE  (p_employee_id IN NUMBER);
END HR_PACKAGE;
/

CREATE OR REPLACE PACKAGE BODY HR_PACKAGE AS

    FUNCTION GET_HEADCOUNT (p_dept_id IN NUMBER) RETURN NUMBER AS
        v_count NUMBER;
    BEGIN
        SELECT COUNT(*)
        INTO   v_count
        FROM   EMPLOYEES
        WHERE  DEPARTMENT_ID = p_dept_id;
        RETURN v_count;
    END GET_HEADCOUNT;

    PROCEDURE SYNC_EMPLOYEE (p_employee_id IN NUMBER) AS
        v_salary NUMBER;
    BEGIN
        -- Reuse the standalone procedure to retrieve the salary
        v_salary := GET_EMPLOYEE_SALARY(p_employee_id);

        -- Log the sync operation into the audit table
        INSERT INTO SALARY_AUDIT_LOG (AUDIT_ID, EMPLOYEE_ID, OLD_SALARY, NEW_SALARY, CHANGED_BY)
        VALUES (EMP_ID_SEQ.NEXTVAL, p_employee_id, v_salary, v_salary, USER);
    END SYNC_EMPLOYEE;

END HR_PACKAGE;
/

-- ==================== TRIGGER ====================

CREATE OR REPLACE TRIGGER PAYROLL_TRIGGER
AFTER UPDATE OF SALARY ON EMPLOYEES
FOR EACH ROW
BEGIN
    INSERT INTO SALARY_AUDIT_LOG (AUDIT_ID, EMPLOYEE_ID, OLD_SALARY, NEW_SALARY, CHANGED_BY, CHANGE_DATE)
    VALUES (EMP_ID_SEQ.NEXTVAL, :NEW.EMPLOYEE_ID, :OLD.SALARY, :NEW.SALARY, USER, SYSDATE);
END PAYROLL_TRIGGER;
/

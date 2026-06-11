export type EmployeeStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
export type ContractType   = 'CDI' | 'CDD' | 'FREELANCE' | 'INTERN';

export interface Employee {
  id: number;
  matricule: string;
  firstName: string;
  lastName: string;
  email: string;
  status: EmployeeStatus;
  hireDate: string;        // ISO date: YYYY-MM-DD
  contractType: ContractType;
  departmentId: number | null;
  managerId: number | null;
  phone: string | null;
  position: string | null;
  annualLeaveBalance: number;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeRequest {
  firstName: string;
  lastName: string;
  email: string;
  hireDate: string;
  contractType: ContractType;
  departmentId: number | null;
  managerId: number | null;
  phone: string | null;
  position: string | null;
  azureOid: string | null;
}

import { query } from "../lib/app-db";

export type EmployeeRow = {
  employee_id: string;
  name: string;
};

export function findAllEmployees(): Promise<EmployeeRow[]> {
  return query<EmployeeRow[]>("SELECT employee_id, name FROM employee");
}

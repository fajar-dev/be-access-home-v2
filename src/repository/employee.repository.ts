import type { AppDatabase } from "../lib/app-database";
import type { EmployeeRow, IEmployeeRepository } from "../interface/employee.interface";

export class EmployeeRepository implements IEmployeeRepository {
  constructor(private readonly db: AppDatabase) {}

  findAll(): Promise<EmployeeRow[]> {
    return this.db.query<EmployeeRow[]>("SELECT employee_id, name FROM employee");
  }
}

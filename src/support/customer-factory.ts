/**
 * Test data model and factory for ParaBank customers.
 *
 * The ParaBank demo site is a shared, persistent environment, so every
 * registration needs a unique username. The factory generates one per call
 * using a timestamp + random suffix, which keeps the suite re-runnable.
 */

export interface Customer {
  firstName: string;
  lastName: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  phoneNumber: string;
  ssn: string;
  username: string;
  password: string;
}

/**
 * Builds a customer with valid, unique data for ParaBank registration.
 *
 * @param overrides - Optional field overrides (useful for negative tests).
 * @returns A fully populated {@link Customer}.
 */
export function createCustomer(overrides: Partial<Customer> = {}): Customer {
  const uniqueSuffix = `${Date.now().toString(36)}${Math.floor(Math.random() * 10_000)}`;

  return {
    firstName: 'Ashik',
    lastName: 'Mohamed',
    address: '21 Banking Street',
    city: 'Bengaluru',
    state: 'Karnataka',
    zipCode: '560001',
    phoneNumber: '9876543210',
    ssn: '457-55-5462',
    username: `ashik_qa_${uniqueSuffix}`,
    password: 'ParaBank@2026',
    ...overrides,
  };
}

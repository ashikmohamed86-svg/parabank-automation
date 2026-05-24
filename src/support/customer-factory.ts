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

/** Boundary-value profiles used by the input-validation scenarios. */
export type BoundaryVariant = 'minimum-length' | 'maximum-length' | 'special-characters';

/** Generates a unique, URL-safe username suffix. */
function uniqueSuffix(): string {
  return `${Date.now().toString(36)}${Math.floor(Math.random() * 10_000)}`;
}

/**
 * Builds a customer with valid, unique data for ParaBank registration.
 *
 * @param overrides - Optional field overrides (useful for negative tests).
 * @returns A fully populated {@link Customer}.
 */
export function createCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    firstName: 'Ashik',
    lastName: 'Mohamed',
    address: '21 Banking Street',
    city: 'Bengaluru',
    state: 'Karnataka',
    zipCode: '560001',
    phoneNumber: '9876543210',
    ssn: '457-55-5462',
    username: `ashik_qa_${uniqueSuffix()}`,
    password: 'ParaBank@2026',
    ...overrides,
  };
}

/**
 * Builds a customer whose field values exercise a specific boundary case,
 * while keeping the username unique so registration still succeeds.
 *
 * @param variant - The boundary profile to apply.
 */
export function createBoundaryCustomer(variant: BoundaryVariant): Customer {
  const base = createCustomer();

  switch (variant) {
    case 'minimum-length':
      return {
        ...base,
        firstName: 'A',
        lastName: 'M',
        address: '1',
        city: 'X',
        state: 'KA',
        zipCode: '1',
        phoneNumber: '1',
        ssn: '1',
      };
    case 'maximum-length': {
      const longText = 'A'.repeat(50);
      return {
        ...base,
        firstName: longText,
        lastName: longText,
        address: 'B'.repeat(80),
        city: longText,
        state: 'Karnataka',
        zipCode: '999999999',
        phoneNumber: '9'.repeat(15),
        ssn: '9'.repeat(11),
      };
    }
    case 'special-characters':
      return {
        ...base,
        firstName: 'Mary-Jane',
        lastName: "O'Brien-D'Souza",
        address: '12/A, St. Anne Road #4',
        city: 'Saint-Denis',
      };
  }
}

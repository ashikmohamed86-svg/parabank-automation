@boundary
Feature: ParaBank registration and login input validation

  As a quality engineer
  I want the registration and login forms to validate input at the boundaries
  So that only well-formed data is accepted and edge cases are handled gracefully

  @negative
  Scenario: Registration is rejected when the password confirmation does not match
    Given the customer is on the ParaBank registration page
    When the customer registers with a mismatched password confirmation
    Then a password confirmation error is shown

  @negative
  Scenario: Registration is rejected when only some mandatory fields are completed
    Given the customer is on the ParaBank registration page
    When the customer submits the registration form with only the name fields completed
    Then validation errors are shown for the remaining mandatory fields

  @positive
  Scenario Outline: Registration succeeds with boundary-value field data
    Given the customer is on the ParaBank registration page
    When the customer registers using "<variant>" field values
    Then the account is created successfully

    Examples:
      | variant            |
      | minimum-length     |
      | maximum-length     |
      | special-characters |

  @negative
  Scenario Outline: Login is rejected when credentials are missing
    Given the customer is on the ParaBank home page
    When the customer signs in with "<credentials>"
    Then login is rejected with an error message

    Examples:
      | credentials                  |
      | empty username               |
      | empty password               |
      | empty username and password  |

@registration
Feature: ParaBank account registration

  As a prospective ParaBank customer
  I want to register for an online banking account
  So that I can securely access online banking services

  @smoke @positive
  Scenario: Register a new customer with valid details
    Given the customer is on the ParaBank registration page
    When the customer registers with valid account details
    Then the account is created successfully
    And the customer is signed in automatically

  @negative
  Scenario: Registration is rejected when mandatory fields are empty
    Given the customer is on the ParaBank registration page
    When the customer submits the registration form without entering any details
    Then validation errors are shown for the mandatory fields

  @negative
  Scenario: Registration is rejected for an already registered username
    Given a customer has already registered an account
    When the customer tries to register again with the same username
    Then a duplicate username error is shown

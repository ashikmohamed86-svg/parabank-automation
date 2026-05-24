@login
Feature: ParaBank account login

  As a registered ParaBank customer
  I want to sign in to my account
  So that I can view my account balance after logging in

  @smoke @positive
  Scenario: Sign in with a newly created account and view the balance
    Given a customer has registered a new ParaBank account
    When the customer signs in with the new account credentials
    Then the Accounts Overview page is displayed
    And the account balance is shown and logged to the console

  @negative
  Scenario: Sign in is rejected with invalid credentials
    Given the customer is on the ParaBank home page
    When the customer signs in with invalid credentials
    Then a login error message is displayed

  @positive
  Scenario: Log out ends the session and returns to the login page
    Given a customer has registered a new ParaBank account
    When the customer signs in with the new account credentials
    And the customer logs out
    Then the Customer Login page is displayed

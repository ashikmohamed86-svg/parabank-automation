@performance
Feature: ParaBank response-time performance

  As a quality engineer
  I want key ParaBank pages and actions to respond within budget
  So that the JPA-backed application stays usable for customers

  Scenario: The home page loads within the performance budget
    When the customer opens the home page and the load time is measured
    Then the measured time is within the page-load budget

  Scenario: The registration page loads within the performance budget
    When the customer opens the registration page and the load time is measured
    Then the measured time is within the page-load budget

  Scenario: Account registration completes within the performance budget
    Given the customer is on the ParaBank registration page
    When the customer registers a new account and the response time is measured
    Then the measured time is within the registration budget

  Scenario: Login completes within the performance budget
    Given a customer has registered a new ParaBank account
    When the customer signs in and the response time is measured
    Then the measured time is within the login budget

  Scenario: The Accounts Overview page loads within the performance budget
    Given a customer has registered a new ParaBank account
    And the customer signs in with the new account credentials
    When the customer reloads the Accounts Overview page and the load time is measured
    Then the measured time is within the page-load budget

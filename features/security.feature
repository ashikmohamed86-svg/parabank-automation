@security
Feature: ParaBank registration and login security

  As a security-conscious quality engineer
  I want the registration and login flows to resist common web attacks
  So that customer accounts and data stay protected

  @positive
  Scenario Outline: Password entry fields mask the characters typed
    Given the customer is on the "<page>" page
    Then the "<field>" field hides the characters that are typed

    Examples:
      | page         | field            |
      | registration | Password         |
      | registration | Confirm Password |
      | home         | Login Password   |

  @negative
  Scenario: SQL injection in the login form does not bypass authentication
    Given the customer is on the ParaBank home page
    When the customer attempts to sign in with a SQL injection payload
    Then the customer is not authenticated

  @negative @fail
  Scenario: HTML injection in the first name field is neutralised
    Given the customer is on the ParaBank registration page
    When the customer registers with an HTML injection payload in the first name
    Then the injected markup is not rendered as live page content

  @positive
  Scenario: The application is served over a secure HTTPS connection
    Given the customer is on the ParaBank home page
    Then the page is served over HTTPS

  @positive
  Scenario: The session cookie is protected with the HttpOnly flag
    Given a customer has registered a new ParaBank account
    When the customer signs in with the new account credentials
    Then the session cookie is flagged HttpOnly

  @negative
  Scenario: Login errors do not reveal whether a username exists
    Given a customer has registered a new ParaBank account
    When the customer signs in with a valid username and a wrong password
    And the customer signs in with an unknown username and password
    Then both login attempts return the same error message

  @negative
  Scenario: Repeated failed logins are consistently rejected
    Given the customer is on the ParaBank home page
    When the customer makes 5 consecutive failed login attempts
    Then every attempt is rejected

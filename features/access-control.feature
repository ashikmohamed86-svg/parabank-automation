@access
Feature: ParaBank session and access control

  As a quality engineer
  I want protected banking pages to require an authenticated session
  So that account data is never exposed to anonymous visitors

  @negative
  Scenario Outline: Protected pages cannot be opened without signing in
    Given no customer is signed in
    When an anonymous visitor opens the "<page>" page directly
    Then access to the page is denied

    Examples:
      | page                |
      | Accounts Overview   |
      | Transfer Funds      |
      | Update Contact Info |

  @negative
  Scenario: Protected pages cannot be opened after logging out
    Given a customer has registered a new ParaBank account
    And the customer signs in with the new account credentials
    When the customer logs out
    And an anonymous visitor opens the "Accounts Overview" page directly
    Then access to the page is denied

  @positive
  Scenario: An authenticated session persists across page navigation
    Given a customer has registered a new ParaBank account
    And the customer signs in with the new account credentials
    When the customer navigates between authenticated pages
    Then the customer remains signed in

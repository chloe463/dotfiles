; cf. https://github.com/nvim-treesitter/nvim-treesitter/blob/93ee00cd9daf8d2e3fbaa2a18b8b9adcb4471b16/queries/ecma/injections.scm#L92-L95
; extends
((comment) @_gql_comment
  (#eq? @_gql_comment "/* GraphQL */")
  (template_string) @injection.content
  (#set! injection.language "graphql"))


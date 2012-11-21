TESTS = $(shell find test -name "*test.js")

test:
	@NODE_ENV=testing ./node_modules/.bin/mocha -t 5000 -u bdd $(TESTS)

.PHONY: test

# GitHub Issue Templates

This directory contains issue templates for the Mallory project.

## Available Templates

### 1. `feature-solana-wallet-support.md`
**Most Comprehensive Version** - Full technical specification with detailed implementation plan.

**Use this when:**
- Creating a GitHub Issue via the web interface
- You want the most detailed technical reference
- Planning the full implementation

**Features:**
- Complete technical architecture
- Detailed code examples
- Security considerations
- Testing strategy
- File structure
- Success criteria
- Future enhancements

### 2. `solana-wallet-github-issue.md`
**Copy-Paste Ready** - Formatted for direct GitHub issue creation.

**Use this when:**
- Creating an issue manually (copy-paste into GitHub)
- You want a balance of detail and brevity
- Quick reference with implementation checklist

**Features:**
- GitHub issue format (problem/solution/alternatives)
- Implementation checklist
- Essential technical details
- Success metrics

## How to Use

### Method 1: GitHub Web Interface
1. Go to [Issues](https://github.com/darkresearch/mallory/issues/new/choose)
2. Select "Add Native Solana Wallet Support" template
3. Fill in any additional details
4. Submit

### Method 2: Copy-Paste
1. Open `solana-wallet-github-issue.md`
2. Copy the entire contents
3. Go to [New Issue](https://github.com/darkresearch/mallory/issues/new)
4. Paste the contents
5. Edit as needed and submit

### Method 3: Reference Document
Use `feature-solana-wallet-support.md` as a reference during implementation.

## Additional Resources

See also the root-level `ISSUE_SOLANA_WALLET_SUPPORT.md` for a medium-length version with visual diagrams and clear structure.

## Creating New Templates

When creating new issue templates:
1. Place them in this directory (`.github/ISSUE_TEMPLATE/`)
2. Use the frontmatter format for GitHub integration:
   ```yaml
   ---
   name: Template Name
   about: Brief description
   title: '[TYPE] Title'
   labels: label1, label2
   assignees: ''
   ---
   ```
3. Update this README to document the new template

## Questions?

For questions about these templates or the Solana wallet support feature:
- GitHub Discussions: https://github.com/darkresearch/mallory/discussions
- Email: hello@darkresearch.ai

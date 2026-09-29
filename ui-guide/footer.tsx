/**
 * The guide's footer (#400): the library's licence, where it lives, where it is published, who
 * designed it and who made it. On every page, under the page column and the navigation.
 */

import { Cluster } from "@spy4x/preact-ui/layout"
import type { JSX } from "preact"
import { JSR_SCOPE_URL, repositoryFile } from "./overview.tsx"

/** The design system's author, credited in the footer (`CREDITS.md`, #258). */
export const DESIGN_CREDIT_URL = "https://github.com/Eirene"

/** Who made the library, as the host names them: the footer and the header link to them. */
export interface GuideAuthor {
  /** The name the "Made by" link shows. */
  name: string
  /** Where the link goes. */
  href: string
}

/** Every word the footer prints. The shell fills each from its labels. */
export interface FooterLabels {
  title: string
  footerNote: string
  sourceCode: string
  jsr: string
  licence: string
  designBy: string
  madeBy: (name: string) => string
}

/** Props of {@link GuideFooter}. */
export interface GuideFooterProps {
  labels: FooterLabels
  repository?: string
  author?: GuideAuthor
}

const LINK =
  "text-muted underline decoration-control underline-offset-4 hover:text-foreground hover:decoration-control"

/**
 * The footer: the library's name and one line, then its links. A link the host gave no address for
 * (the repository, the author) is left out rather than pointing nowhere; the licence still says its
 * name.
 *
 * @param props See {@link GuideFooterProps}.
 */
export function GuideFooter({ labels, repository, author }: GuideFooterProps): JSX.Element {
  return (
    <footer
      data-e2e="ui-guide-footer"
      class="border-t border-subtle"
    >
      <div class="mx-auto flex max-w-screen-2xl flex-col gap-4 px-4 py-8 text-sm sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <p class="text-muted">
          <span class="font-semibold text-foreground">{labels.title}</span> {labels.footerNote}
        </p>
        <Cluster as="ul" gap="md">
          {repository
            ? (
              <li>
                <a href={repository} rel="noreferrer" class={LINK} data-footer-link="repository">
                  {labels.sourceCode}
                </a>
              </li>
            )
            : null}
          <li>
            <a href={JSR_SCOPE_URL} rel="noreferrer" class={LINK} data-footer-link="jsr">
              {labels.jsr}
            </a>
          </li>
          <li>
            {repository
              ? (
                <a
                  href={repositoryFile(repository, "LICENSE")}
                  rel="noreferrer"
                  class={LINK}
                  data-footer-link="licence"
                >
                  {labels.licence}
                </a>
              )
              : <span class="text-muted">{labels.licence}</span>}
          </li>
          <li class="text-muted">
            {labels.designBy}{" "}
            <a href={DESIGN_CREDIT_URL} rel="noreferrer" class={LINK} data-footer-link="design">
              Eirene
            </a>
          </li>
          {author
            ? (
              <li>
                <a href={author.href} rel="noreferrer" class={LINK} data-footer-link="author">
                  {labels.madeBy(author.name)}
                </a>
              </li>
            )
            : null}
        </Cluster>
      </div>
    </footer>
  )
}

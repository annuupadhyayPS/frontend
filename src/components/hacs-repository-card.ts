import "@material/mwc-button/mwc-button";
import { mdiDotsVertical } from "@mdi/js";
import "@polymer/paper-item/paper-item";
import "@polymer/paper-item/paper-item-body";
import "@polymer/paper-listbox/paper-listbox";
import "@polymer/paper-menu-button/paper-menu-button";
import { css, CSSResultGroup, html, LitElement, TemplateResult } from "lit";
import { customElement, property } from "lit/decorators";
import { ClassInfo, classMap } from "lit/directives/class-map";
import { navigate } from "../../homeassistant-frontend/src/common/navigate";
import "../../homeassistant-frontend/src/components/ha-card";
import { getConfigEntries } from "../../homeassistant-frontend/src/data/config_entries";
import { showAlertDialog } from "../../homeassistant-frontend/src/dialogs/generic/show-dialog-box";
import { HomeAssistant } from "../../homeassistant-frontend/src/types";
import { RemovedRepository, Repository, Status } from "../data/common";
import { Hacs } from "../data/hacs";
import {
  deleteResource,
  fetchResources,
  repositorySetNotNew,
  repositoryUninstall,
  repositoryUpdate,
} from "../data/websocket";
import { HacsStyles } from "../styles/hacs-common-style";
import { generateLovelaceURL } from "../tools/added-to-lovelace";
import "./hacs-chip";
import { hacsIcon } from "./hacs-icon";
import "./hacs-link";

@customElement("hacs-repository-card")
export class HacsRepositoryCard extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;

  @property({ attribute: false }) public hacs!: Hacs;

  @property({ attribute: false }) public repository!: Repository;

  @property({ attribute: false }) public status: Status;

  @property({ attribute: false }) public removed: RemovedRepository[];

  @property({ type: Boolean }) public narrow!: boolean;

  @property({ type: Boolean }) public addedToLovelace!: boolean;

  private get _borderClass(): ClassInfo {
    const classes = {};
    if (!this.addedToLovelace || this.repository.status === "pending-restart") {
      classes["status-issue"] = true;
    } else if (this.repository.pending_upgrade) {
      classes["status-update"] = true;
    } else if (this.repository.new && !this.repository.installed) {
      classes["status-new"] = true;
    }
    if (Object.keys(classes).length !== 0) {
      classes["status-border"] = true;
    }

    return classes;
  }

  private get _headerClass(): ClassInfo {
    const classes = {};
    if (!this.addedToLovelace || this.repository.status === "pending-restart") {
      classes["issue-header"] = true;
    } else if (this.repository.pending_upgrade) {
      classes["update-header"] = true;
    } else if (this.repository.new && !this.repository.installed) {
      classes["new-header"] = true;
    } else {
      classes["default-header"] = true;
    }

    return classes;
  }

  private get _headerTitle(): string {
    if (!this.addedToLovelace) {
      return this.hacs.localize("repository_card.not_loaded");
    }
    if (this.repository.status === "pending-restart") {
      return this.hacs.localize("repository_card.pending_restart");
    }
    if (this.repository.pending_upgrade) {
      return this.hacs.localize("repository_card.pending_update");
    }
    if (this.repository.new && !this.repository.installed) {
      return this.hacs.localize("repository_card.new_repository");
    }
    return "";
  }

  protected render(): TemplateResult | void {
    const path = this.repository.local_path.split("/");
    return html`
      <ha-card class=${classMap(this._borderClass)} ?narrow=${this.narrow}>
        <div class="card-content">
          <div class="group-header">
            <div class="status-header ${classMap(this._headerClass)}">${this._headerTitle}</div>
            <div class="title">
              <h1 class="pointer" @click=${this._showReopsitoryInfo}>${this.repository.name}</h1>
              ${this.repository.category !== "integration"
                ? html` <hacs-chip
                    .icon=${hacsIcon}
                    .value=${this.hacs.localize(`common.${this.repository.category}`)}
                  ></hacs-chip>`
                : ""}
            </div>
          </div>
          <paper-item>
            <paper-item-body>${this.repository.description}</paper-item-body></paper-item
          >
        </div>
        <div class="card-actions">
          ${this.repository.new && !this.repository.installed
            ? html`<div>
                  <mwc-button @click=${this._installRepository}
                    >${this.hacs.localize("common.install")}</mwc-button
                  >
                </div>
                <div>
                  <mwc-button @click=${this._showReopsitoryInfo}
                    >${this.hacs.localize("repository_card.information")}</mwc-button
                  >
                </div>
                <div>
                  <hacs-link .url="https://github.com/${this.repository.full_name}"
                    ><mwc-button>${this.hacs.localize("common.repository")}</mwc-button></hacs-link
                  >
                </div>
                <div>
                  <mwc-button @click=${this._setNotNew}
                    >${this.hacs.localize("repository_card.dismiss")}</mwc-button
                  >
                </div>`
            : this.repository.pending_upgrade && this.addedToLovelace
            ? html`<div>
                  <mwc-button class="update-header" @click=${this._updateRepository} raised
                    >${this.hacs.localize("common.update")}</mwc-button
                  >
                </div>
                <div>
                  <hacs-link .url="https://github.com/${this.repository.full_name}"
                    ><mwc-button>${this.hacs.localize("common.repository")}</mwc-button></hacs-link
                  >
                </div>`
            : html`<div>
                <hacs-link .url="https://github.com/${this.repository.full_name}"
                  ><mwc-button>${this.hacs.localize("common.repository")}</mwc-button></hacs-link
                >
              </div>`}
          ${this.repository.installed
            ? html` <paper-menu-button
                horizontal-align="right"
                vertical-align="top"
                vertical-offset="40"
                close-on-activate
              >
                <mwc-icon-button slot="dropdown-trigger" alt="menu">
                  <ha-svg-icon .path=${mdiDotsVertical}></ha-svg-icon>
                </mwc-icon-button>
                <paper-listbox slot="dropdown-content">
                  <paper-item class="pointer" @tap=${this._showReopsitoryInfo}
                    >${this.hacs.localize("repository_card.information")}</paper-item
                  >

                  <paper-item class="pointer" @tap=${this._updateReopsitoryInfo}
                    >${this.hacs.localize("repository_card.update_information")}</paper-item
                  >

                  <paper-item @tap=${this._installRepository}
                    >${this.hacs.localize("repository_card.reinstall")}</paper-item
                  >

                  ${this.repository.category === "plugin"
                    ? html`<hacs-link
                        .url="/hacsfiles/${path.pop()}/${this.repository.file_name}"
                        newtab
                        ><paper-item class="pointer"
                          >${this.hacs.localize("repository_card.open_source")}</paper-item
                        ></hacs-link
                      >`
                    : ""}

                  <hacs-link .url="https://github.com/${this.repository.full_name}/issues"
                    ><paper-item class="pointer"
                      >${this.hacs.localize("repository_card.open_issue")}</paper-item
                    ></hacs-link
                  >

                  ${String(this.repository.id) !== "172733314"
                    ? html`<hacs-link
                          .url="https://github.com/hacs/integration/issues/new?assignees=ludeeus&labels=flag&template=removal.yml&repo=${this
                            .repository.full_name}&title=Request for removal of ${this.repository
                            .full_name}"
                          ><paper-item class="pointer uninstall"
                            >${this.hacs.localize("repository_card.report")}</paper-item
                          ></hacs-link
                        >
                        <paper-item
                          class="pointer uninstall"
                          @tap=${this._uninstallRepositoryDialog}
                          >${this.hacs.localize("common.uninstall")}</paper-item
                        >`
                    : ""}
                </paper-listbox>
              </paper-menu-button>`
            : ""}
        </div>
      </ha-card>
    `;
  }

  private async _updateReopsitoryInfo() {
    await repositoryUpdate(this.hass, this.repository.id);
  }

  private async _showReopsitoryInfo() {
    this.dispatchEvent(
      new CustomEvent("hacs-dialog", {
        detail: {
          type: "repository-info",
          repository: this.repository.id,
        },
        bubbles: true,
        composed: true,
      })
    );
  }

  private async _updateRepository() {
    this.dispatchEvent(
      new CustomEvent("hacs-dialog", {
        detail: {
          type: "update",
          repository: this.repository.id,
        },
        bubbles: true,
        composed: true,
      })
    );
  }

  private async _setNotNew() {
    await repositorySetNotNew(this.hass, this.repository.id);
  }

  private _installRepository() {
    this.dispatchEvent(
      new CustomEvent("hacs-dialog", {
        detail: {
          type: "install",
          repository: this.repository.id,
        },
        bubbles: true,
        composed: true,
      })
    );
  }

  private async _uninstallRepositoryDialog() {
    if (this.repository.category === "integration" && this.repository.config_flow) {
      const configFlows = (await getConfigEntries(this.hass)).some(
        (entry) => entry.domain === this.repository.domain
      );
      if (configFlows) {
        await showAlertDialog(this, {
          title: this.hacs.localize("dialog.configured.title"),
          text: this.hacs.localize("dialog.configured.message", { name: this.repository.name }),
          confirmText: this.hacs.localize("dialog.configured.confirm"),
          confirm: () => {
            navigate("/config/integrations", { replace: true });
          },
        });
        return;
      }
    }
    this.dispatchEvent(
      new CustomEvent("hacs-dialog", {
        detail: {
          type: "progress",
          title: this.hacs.localize("dialog.uninstall.title"),
          confirmText: this.hacs.localize("dialog.uninstall.title"),
          content: this.hacs.localize("dialog.uninstall.message", { name: this.repository.name }),
          confirm: async () => {
            await this._uninstallRepository();
          },
        },
        bubbles: true,
        composed: true,
      })
    );
  }

  private async _uninstallRepository() {
    if (this.repository.category === "plugin" && this.hacs.status?.lovelace_mode !== "yaml") {
      const resources = await fetchResources(this.hass);
      const expectedURL = generateLovelaceURL({ repository: this.repository, skipTag: true });
      await Promise.all(
        resources
          .filter((resource) => resource.url.includes(expectedURL))
          .map((resource) => deleteResource(this.hass, String(resource.id)))
      );
    }
    await repositoryUninstall(this.hass, this.repository.id);
  }

  static get styles(): CSSResultGroup {
    return [
      HacsStyles,
      css`
        ha-card {
          display: flex;
          flex-direction: column;
          height: 100%;
          width: 480px;
          border-style: solid;
          border-width: min(var(--ha-card-border-width, 1px), 10px);
          border-color: transparent;
          border-radius: var(--ha-card-border-radius, 4px);
        }

        hacs-chip {
          margin: 8px 4px 0 0;
        }
        .title {
          display: flex;
          justify-content: space-between;
        }
        .card-content {
          padding: 0 0 3px 0;
          height: 100%;
        }
        .card-actions {
          border-top: none;
          bottom: 0;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 5px;
        }
        .group-header {
          height: auto;
          align-content: center;
        }
        .group-header h1 {
          margin: 0;
          padding: 8px 16px;
        }
        h1 {
          margin-top: 0;
          min-height: 24px;
        }
        paper-menu-button {
          padding: 0;
          float: right;
        }

        .pointer {
          cursor: pointer;
        }
        paper-item-body {
          opacity: var(--dark-primary-opacity);
        }

        .status-new {
          border-color: var(--hcv-color-new);
        }

        .status-update {
          border-color: var(--hcv-color-update);
        }

        .status-issue {
          border-color: var(--hcv-color-error);
        }

        .new-header {
          background-color: var(--hcv-color-new);
          color: var(--hcv-text-color-on-background);
        }

        .issue-header {
          background-color: var(--hcv-color-error);
          color: var(--hcv-text-color-on-background);
        }

        .update-header {
          background-color: var(--hcv-color-update);
          color: var(--hcv-text-color-on-background);
        }

        .default-header {
          padding: 10px 0 !important;
        }

        mwc-button.update-header {
          --mdc-theme-primary: var(--hcv-color-update);
          --mdc-theme-on-primary: var(--hcv-text-color-on-background);
        }

        .status-border {
          border-style: solid;
          border-width: min(var(--ha-card-border-width, 1px), 10px);
        }

        .status-header {
          top: 0;
          padding: 6px 1px;
          margin: -1px;
          width: 100%;
          font-weight: 300;
          text-align: center;
          left: 0;
          border-top-left-radius: var(--ha-card-border-radius, 4px);
          border-top-right-radius: var(--ha-card-border-radius, 4px);
        }

        ha-card[narrow] {
          width: calc(100% - 24px);
          margin: 11px;
        }
      `,
    ];
  }
}

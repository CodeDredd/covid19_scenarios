import React, { useState } from 'react'

import { FileRejection } from 'react-dropzone'
import { useTranslation } from 'react-i18next'
import { If, Then } from 'react-if'
import { Col, Row, Container, UncontrolledAlert } from 'reactstrap'
import type { AnyAction } from 'typescript-fsa'

import type { SeverityDistributionDatum } from '../../../algorithms/types/Param.types'
import { appendDash } from '../../../helpers/appendDash'

import { readFile, FileReaderError } from '../../../helpers/readFile'

import { setStateData } from '../state/actions'
import { deserialize, DeserializationError } from '../state/serialize'

import { ScenarioLoaderUploadZone } from './ScenarioLoaderUploadZone'

import ScenarioLoaderUploadInstructionsText from './ScenarioLoaderUploadInstructionsText.mdx'

class UploadErrorTooManyFiles extends Error {
  public readonly nFiles?: number
  constructor(nFiles?: number) {
    super(`when uploading: one file is expected, but got ${nFiles}`)
    this.nFiles = nFiles
  }
}

class UploadErrorUnknown extends Error {
  constructor() {
    super(`when uploading: unknown error`)
  }
}

export interface ScenarioLoaderUploaderProps {
  close(): void
  setSeverity(severity: SeverityDistributionDatum[]): void
  scenarioDispatch(action: AnyAction): void
}

export function ScenarioLoaderUploader({ scenarioDispatch, setSeverity, close }: ScenarioLoaderUploaderProps) {
  const { t } = useTranslation()
  const [errors, setErrors] = useState<string[]>([])

  const hasErrors = errors.length > 0

  if (hasErrors) {
    console.warn(`Errors when uploading:\n${errors.map(appendDash).join('\n')}`)
  }

  function handleError(error: Error) {
    if (error instanceof UploadErrorTooManyFiles) {
      setErrors((prevErrors) => [...prevErrors, t('Only one file is expected')])
    } else if (error instanceof UploadErrorUnknown) {
      setErrors((prevErrors) => [...prevErrors, t('Unknown error')])
    } else if (error instanceof FileReaderError) {
      setErrors((prevErrors) => [...prevErrors, t('Unable to read file.')])
    } else if (error instanceof DeserializationError) {
      const errors = error?.errors
      if (errors && errors.length > 0) {
        setErrors((prevErrors) => [...prevErrors, ...errors])
      }
    } else {
      throw error
    }
  }

  async function processFiles(acceptedFiles: File[], rejectedFiles: FileRejection[]) {
    const nFiles = acceptedFiles.length + rejectedFiles.length

    if (nFiles > 1) {
      throw new UploadErrorTooManyFiles(nFiles)
    }

    if (acceptedFiles.length !== 1) {
      throw new UploadErrorTooManyFiles(acceptedFiles.length)
    }

    const str = await readFile(acceptedFiles[0])
    const params = deserialize(str)

    if (!params) {
      throw new UploadErrorUnknown()
    }

    scenarioDispatch(
      setStateData({
        current: params.scenarioName,
        data: params.scenario,
        ageDistribution: params.ageDistribution,
      }),
    )

    setSeverity(params.severity)

    close()
  }

  async function onDrop(acceptedFiles: File[], rejectedFiles: FileRejection[]) {
    setErrors([])

    try {
      await processFiles(acceptedFiles, rejectedFiles)
    } catch (error) {
      handleError(error)
      return
    }

    setErrors([])
  }

  return (
    <Container>
      <h3>{t(`Upload scenario`)}</h3>

      <ScenarioLoaderUploadInstructionsText />

      <Row noGutters>
        <Col>
          <ScenarioLoaderUploadZone onDrop={onDrop} />
        </Col>
      </Row>

      <Row noGutters className="my-3">
        <Col>
          <If condition={hasErrors}>
            <Then>
              <>
                <h4 className="text-danger">{t(`Errors`)}</h4>
                <p className="text-danger">{t(`We detected the following errors while processing the file:`)}</p>
                <section className="overflow-y-auto">
                  {errors.map((error) => (
                    <UncontrolledAlert color="danger" className="text-monospace small" key={error}>
                      {error}
                    </UncontrolledAlert>
                  ))}
                </section>
              </>
            </Then>
          </If>
        </Col>
      </Row>
    </Container>
  )
}
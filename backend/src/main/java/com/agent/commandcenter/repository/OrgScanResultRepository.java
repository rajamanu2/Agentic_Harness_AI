package com.agent.commandcenter.repository;

import com.agent.commandcenter.model.OrgScanResult;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface OrgScanResultRepository extends JpaRepository<OrgScanResult, UUID> {
    Optional<OrgScanResult> findTopByOrderByCreatedAtDesc();

    List<OrgScanResult> findTop25ByOrderByCreatedAtDesc();
}
